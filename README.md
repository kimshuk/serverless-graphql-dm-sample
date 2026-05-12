# Serverless GraphQL DM Sample

이 저장소는 실제 프로덕션 환경에서 구현했던 백엔드 패턴을 기반으로 재구성한 포트폴리오용 sanitized sample입니다. 회사의 독점 소스 코드, 내부 인프라 정보, 고객 데이터, 비밀키, 내부 비즈니스 로직은 포함하지 않습니다.

## 문제 정의

실시간 DM 기능은 단순히 메시지 테이블 하나만으로는 충분하지 않습니다. 메시지 전송 시 메시지를 저장하는 동시에 대화방 메타데이터를 갱신하고, 사용자별 읽음/안읽음 상태를 유지하며, 접속 중인 클라이언트에는 실시간 이벤트를 전달하고, 모바일 푸시 알림도 비동기로 fan-out해야 합니다.

이 샘플은 아래 백엔드 구조에 집중합니다.

- 1:1 또는 소규모 그룹 대화방 메타데이터
- 메시지 저장과 unread counter 갱신을 위한 DynamoDB transaction
- 실시간 인앱 전달을 위한 AppSync GraphQL subscription
- 비동기 알림 fan-out을 위한 DynamoDB Streams
- 실제 Firebase 인증정보 대신 mock push provider interface 사용

## 아키텍처

```text
Client
  |
  | GraphQL mutation: sendDirectMessage
  v
AWS AppSync
  |
  | Lambda resolver
  v
sendDirectMessage Lambda
  |
  | DynamoDB TransactWriteItems
  v
DirectMessagesTable + ConversationsTable + ConversationParticipantsTable + AttachmentsTable
  |
  | DynamoDB Stream INSERT
  v
notifyDM Lambda
  |
  | IAM GraphQL mutation: notifyDMed
  v
AWS AppSync
  |
  +--> onDMed subscription for realtime message delivery
  +--> onNotified subscription for in-app notification delivery
  +--> mockPushProvider.sendMulticast for mobile push shape
```

Subscription의 장기 WebSocket 연결은 AppSync가 관리합니다. Lambda는 이벤트를 생성하거나 fan-out을 처리하지만, WebSocket 연결을 직접 오래 유지하지 않습니다.

## 데이터 모델

| Table | 역할 |
| --- | --- |
| `UsersTable` | 발신자 표시 정보에 사용하는 최소 사용자 프로필 |
| `ConversationsTable` | 참여자, 마지막 메시지, 마지막 수정 시각 등 대화방 메타데이터 |
| `ConversationParticipantsTable` | 사용자별 읽음 상태와 unread count |
| `DirectMessagesTable` | `conversationId`, `messageId` 기반 메시지 저장소 |
| `AttachmentsTable` | 메시지에 연결된 선택적 이미지/비디오 첨부파일 메타데이터 |
| `NotificationsTable` | 인앱 알림 레코드 |
| `NotificationTokensTable` | mock push fan-out 경로에서 사용하는 토큰 저장 형태 |

## Transaction 설계

`sendDirectMessage`는 하나의 `TransactWriteItems` 요청으로 아래 작업을 원자적으로 처리합니다.

- `DirectMessagesTable`에 메시지 저장
- `ConversationsTable.lastMessage`, `lastModified` 갱신
- 발신자 participant의 `updatedAt` 갱신
- 모든 수신자 participant의 `lastReceivedMessageId`, `updatedAt`, `unreadMessageCount` 갱신
- 선택적 첨부파일 메타데이터를 `AttachmentsTable`에 저장

조건부 write를 사용해 존재하지 않는 conversation 또는 participant row에 대한 잘못된 갱신을 방지합니다. Transaction 구성 로직은 `src/lib/directMessageTransaction.ts`의 순수 함수로 분리되어 있어 AWS 없이도 단위 테스트가 가능합니다.

## 실시간 전달 설계

`onDMed(conversationId)`는 `sendDirectMessage` mutation을 구독합니다. Mutation이 성공하면 AppSync가 반환된 `Message`를 조건에 맞는 구독자에게 전달합니다.

`notifyDM`은 별도 경로로 동작합니다. `DirectMessagesTable`에 INSERT stream 이벤트가 발생하면 실행되고, 발신자를 제외한 참여자별로 내부 IAM 전용 `notifyDMed` mutation을 호출합니다. 이를 통해 실시간 메시지 전달 경로와 비동기 알림 fan-out 경로를 분리합니다.

## Cold Start 및 비용 고려

WebSocket 연결은 AppSync가 관리하므로 Lambda cold start가 subscription 연결 유지 시간에는 영향을 주지 않습니다. 다만 `sendDirectMessage`처럼 쓰기 경로에 Lambda resolver가 있는 경우, cold start는 mutation 실행 지연에는 영향을 줄 수 있습니다.

이 샘플은 단순 조회/갱신은 AppSync direct DynamoDB resolver에 적합하게 두고, orchestration이 필요한 transaction 구성과 stream fan-out에는 Lambda를 사용합니다.

## 보안 및 Sanitization 안내

이 샘플은 아래 정보를 의도적으로 제외합니다.

- AWS account ID, ARN, custom domain, 실제 bucket name, 배포 endpoint
- Firebase service account 파일 또는 push credential
- 회사명, 제품명, 고객 데이터, 프로덕션 테이블명
- private/company repository의 원본 git history

`.env.example`은 로컬 설정 템플릿 용도로만 사용합니다.

## 실행 방법

의존성 설치:

```bash
npm install
```

로컬 단위 테스트 실행:

```bash
npm test
```

타입 체크:

```bash
npm run typecheck
```

본인이 관리하는 AWS 계정에 배포:

```bash
npm run deploy -- --stage dev --region us-west-1
```

## Mutation 예시

```graphql
mutation SendDirectMessage {
  sendDirectMessage(
    conversationId: "conversation-id"
    message: "hello"
  ) {
    conversationId
    messageId
    fromId
    message
    timestamp
  }
}
```

## 로컬 테스트 범위

포함된 테스트는 실제 AWS 호출을 하지 않도록 구성했습니다.

- `sendDirectMessage` transaction item 생성
- 첨부파일 metadata write 생성
- 발신자를 제외한 알림 수신자 fan-out 계산

실제 AppSync subscription, DynamoDB Streams, push delivery는 샘플을 배포한 별도 AWS sandbox 환경에서 검증하는 것을 전제로 합니다.
