---
title: Jam
cssclasses:
  - no-meta
---


Jam은 C++로 개발하고 있는 멀티플레이 게임 서버 프레임워크입니다.

단순히 패킷을 전달하는 네트워크 라이브러리가 아니라, **서버 권위형 월드를 여러 실행 단위로 나누어 시뮬레이션하고 그 결과를 클라이언트에 일관되게 전달하는 전체 런타임**을 만드는 것이 목표입니다. 네트워크, 실행 모델, 물리, 상태 복제, 콘텐츠 데이터, Unity 연동을 서로 독립된 기능으로 쌓기보다 명확한 소유권과 데이터 흐름 안에서 연결하고 있습니다.

## Motivation

실시간 멀티플레이 서버는 연결과 패킷 처리만으로 완성되지 않습니다. 사용자가 늘어나고 여러 월드가 동시에 실행되기 시작하면 다음 문제가 함께 나타납니다.

- 어느 스레드가 세션과 월드 상태를 소유하는가
- 비동기 요청과 콜백은 언제까지 유효한가
- 패킷 손실과 순서 역전을 어떻게 처리하는가
- 어떤 Actor를 누구에게 얼마나 자주 복제할 것인가
- 물리 시뮬레이션과 게임 로직을 어떻게 병렬화할 것인가
- 네이티브 런타임의 결과를 Unity에 어떤 계약으로 전달할 것인가

Jam은 이 문제들을 개별적인 예외 처리로 해결하지 않고, 실행 위치와 상태의 권위를 구조적으로 드러내는 방향으로 설계하고 있습니다.

## Architecture

```text
Unity Client
    ↕ C ABI / Presentation Events
JamUnityBridge
    ↕
JamNet Client Runtime
    ↕ UDP Session
JamNet Server Runtime
    ├─ Global Execution
    ├─ Shard Execution
    ├─ World Simulation
    ├─ AOI / Replication
    └─ Physics (JamPx / PhysX)
         ↕
Shared Data / Generated Schema
```

### JamBase

프로젝트 전반에서 사용하는 기본 타입, 식별자, 로깅, 경량 컨테이너와 공통 유틸리티를 제공합니다. 상위 시스템의 정책을 포함하지 않는 작은 기반 계층으로 유지합니다.

### JamNet

세션, 실행기, 월드 시뮬레이션과 상태 복제를 담당하는 핵심 런타임입니다.

- UDP 기반 통신과 reliability·ordering·fragmentation
- Global 및 shard 단위 실행 모델
- 서버와 클라이언트 런타임
- 월드와 actor lifecycle
- AOI 기반 관심 영역 관리
- full/delta state 복제와 baseline 관리
- 입력 전달과 correction replay

### JamPx

PhysX를 월드 시뮬레이션에 연결하는 물리 계층입니다. 물리 객체의 생성과 수명, 비동기 simulation step, 결과 반영을 shard 실행 모델과 조율합니다.

### JamUnityBridge

C++ 클라이언트 런타임과 Unity 사이의 경계입니다. C ABI를 통해 명령을 전달하고, Unity가 소비할 수 있는 presentation event와 frame으로 네이티브 상태를 노출합니다.

### Shared Data and JamTools

월드, actor, 레벨, 물리 자산을 JSON Schema로 정의하고 C++ 및 C# 타입을 생성합니다. 서버와 Unity가 동일한 데이터 계약을 사용하면서도 각 런타임의 표현과 소유권은 분리합니다.

## Design Principles

### Single State Owner

세션과 월드 객체는 담당 실행기에 귀속됩니다. 다른 실행 위치에서는 상태를 직접 공유하기보다 mailbox와 명시적인 요청을 통해 작업을 전달합니다. 잠금 범위를 줄이는 동시에 변경 순서를 예측할 수 있도록 하기 위한 선택입니다.

### Independent World Simulation

각 월드는 입력, 물리, AOI, replication phase를 순서대로 수행합니다. 여러 월드는 shard에 분산할 수 있지만, 한 월드 내부의 상태 변경 규칙은 동일하게 유지합니다.

### Server Authority and Client Presentation

클라이언트는 이동 결과가 아닌 입력 의도를 전송합니다. actor의 생성, 위치, 월드 소속과 생명주기는 서버가 결정하며 클라이언트는 복제된 상태를 화면에 반영합니다.

### Explicit Boundary Contracts

네트워크 wire schema, Shared Data schema, C ABI처럼 시스템 경계를 통과하는 데이터는 암묵적인 내부 표현에 의존하지 않습니다. 식별자 의미와 수명, 실패 결과를 계약에 포함합니다.

## Technical Topics

- shard affinity와 low-contention 실행 구조
- UDP ACK, 재전송, RTT/RTO 및 ordered delivery
- 월드 진입과 actor spawn lifecycle
- AOI membership과 replication의 책임 분리
- actor baseline ACK 기반 full/delta state 전환
- 서버 권위형 입력 처리와 클라이언트 보정
- PhysX task scheduling과 simulation tick budget
- Unity presentation과 네이티브 런타임의 수명 분리
- 스키마 기반 C++/C# 코드 생성 및 자산 검증

## Reading Order

Jam의 전체 구조를 처음 읽는 경우 다음 순서를 권장합니다. 앞쪽 문서에서 정의한 ownership과 data flow가 뒤쪽 시스템의 전제가 됩니다.

1. [[Projects/Jam/Execution Model/index|Execution Model]] — 상태 소유권, 실행 위치와 cross-thread dispatch
2. [[Projects/Jam/Networking/index|Networking]] — transport, session과 delivery contract
3. [[Projects/Jam/Game World/index|Game World]] — world entry, actor lifecycle과 authoritative simulation
4. [[Projects/Jam/State Synchronization/index|State Synchronization]] — lifecycle, snapshot, baseline과 prediction
5. [[Projects/Jam/Physics/index|Physics]] — physics object model과 simulation scheduling
6. [[Projects/Jam/Client Integration/index|Client Integration]] — native client state와 Unity presentation boundary
7. [[Projects/Jam/Data Pipeline/index|Data Pipeline]] — server와 client가 공유하는 content contract
8. [[Projects/Jam/Observability/index|Observability]] — runtime metrics와 performance validation

## Validation Project

Jam의 기능은 별도의 예제에 머물지 않고 [[Projects/M1/index|M1]]에서 실제 MMORPG 형태의 사용자 흐름과 부하 시나리오로 검증합니다. 월드 진입, 이동, AOI replication, 포탈 전환과 채팅을 조합해 기능 정확성과 처리 한계를 함께 확인하는 것이 목적입니다.

## Implementation and Validation Status

아래 표의 검증 상태는 현재 문서와 M1 기반 기능·통합 검증 범위를 기준으로 합니다. `Validated`는 문서에 기술된 주요 기능과 통합 경로가 검증되었다는 의미이며, 추가 tuning과 coverage 확장은 Notes에 구분합니다. `Partial`은 핵심 계약 중 아직 검증되지 않은 경로가 남아 있는 경우에만 사용합니다.

| Area                  | Implementation | Validation | Notes                                                                            |
| --------------------- | -------------- | ---------- | -------------------------------------------------------------------------------- |
| Execution Model       | Implemented    | Validated  | owner-local execution, mailbox와 fiber 경로 검증; topology tuning 및 성능 개선 진행          |
| Networking            | Implemented    | Partial    | TCP/UDP session과 reliable delivery 구현, congestion 및 failure scenario 검증 진행 중     |
| Data Pipeline         | Implemented    | Validated  | schema 기반 C++/C# 생성과 runtime load 통합 경로 검증                                       |
| Game World            | Implemented    | Validated  | transition, lifecycle, simulation과 AOI 주요 경로 검증 및 성능개선 진행. LOS는 experimental     |
| State Synchronization | Implemented    | Validated  | lifecycle, full/delta state, baseline과 client replay 주요 경로 검증; tuning 및 성능 개선 진행 |
| Physics               | Implemented    | Validated  | PhysX runtime, filtering과 async scheduling 주요 경로 검증; 성능 개선 진행                    |
| Client Integration    | Implemented    | Validated  | native runtime, C ABI와 Unity presentation 통합 경로 검증                               |
| Observability         | Implemented    | Validated  | metrics aggregation과 catalog 검증; 부하·장애 coverage 확장 중                             |


## Current Status

Jam은 계속 개발 중인 개인 프로젝트입니다. 핵심 런타임과 Unity 연동, 월드 시뮬레이션 및 복제 경로는 구현되어 있으며, 현재는 M1 콘텐츠 확장과 함께 관측성, 부하 검증, 장애 상황의 동작을 구체화하고 있습니다.
