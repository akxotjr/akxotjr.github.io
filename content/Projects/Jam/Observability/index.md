---
title: Observability
cssclasses:
  - no-meta
---

## Core Idea

Shard 기반 서버에서 처리 지연이 발생했을 때 CPU 사용률 하나만으로는 원인을 설명하기 어렵다. 특정 Shard의 작업이 밀린 것인지, World Tick의 Physics나 AOI가 오래 걸린 것인지, Reliable Packet이 누적된 것인지 서로 다른 실행 범위의 신호를 함께 봐야 한다.

Jam의 Observability는 모든 기능을 하나의 전역 통계로 합치기보다, 측정값에 실행 범위를 함께 부여한다. process, shard, world를 구분하고 `WorldId`와 shard index를 유지한 채 같은 metrics window에 정렬한다. 이를 통해 성능 문제를 다음 순서로 좁혀 갈 수 있다.

```text
process saturation?
    → executor or shard imbalance?
        → world tick phase spike?
            → network / AOI / replication pressure?
```

현재 구현의 목표는 상시 운영용 대시보드나 분산 추적이 아니다. 재현 가능한 부하 실험에서 실행 모델과 네트워크·월드 설계가 의도대로 동작하는지 검증할 수 있는 로컬 메트릭 파이프라인을 만드는 데 있다.

## End-to-End Observation Flow

```text
Runtime Instrumentation
    ├─ Process
    ├─ Global / Shard Executor
    ├─ Network
    └─ World Simulation / AOI / Replication
                ↓
        MetricSnapshot
   scope + shard + source + time window
                ↓
        Metrics Aggregator
     Sum / Maximum / Latest + Histogram
                ↓
          CSV + HDR HLOG
                ↓
       Phase-based Analysis
                ↓
 hypothesis → comparison → validation
```

Counter와 Gauge는 CSV로, Tick Duration과 AOI 이웃 수처럼 분포가 중요한 값은 HDR Histogram Log로 기록한다. 모든 값을 동일한 방식으로 평균 내지 않고, 값의 의미에 따라 `Sum`, `Maximum`, `Latest`를 선택한다.

출력된 데이터는 warm-up, measurement, cool-down 같은 실험 구간과 결합한다. 이 단계에서 평균과 최댓값뿐 아니라 percentile, Shard 간 편차, Spike Window와 관련 신호를 함께 비교한다.

## Observation Boundaries

| 범위 | 답하려는 질문 | 대표 신호 |
| --- | --- | --- |
| Process | 서버 전체 자원이 포화되었는가 | CPU Usage, Working Set, Private Bytes, Core Usage |
| Executor | 실행기가 일을 처리하거나 기다리는 방식이 정상인가 | Job Count/Cost, Idle/Wait, Fiber Poll, Ready Run |
| Shard | 특정 소유권 영역에 작업이 편중되었는가 | Ingress Jobs, Mailbox Jobs, Scheduler Poll, Tick Catch-up |
| Network | 전송량보다 신뢰성 처리 압력이 증가했는가 | Pending Reliable, Retransmit, Timeout, Out-of-order |
| World | Tick Budget을 어느 단계가 소비하는가 | Input, Physics, AOI, Replication, Finalize Duration |
| Replication | 관심 영역 변화가 전송 비용과 복구를 유발하는가 | Snapshot Bytes/Actors, Lifecycle Pending, Baseline Resync |

이 범위들은 독립적인 대시보드 항목이 아니라 인과관계를 확인하기 위한 관측 지점이다. 예를 들어 tick duration이 증가했다면 phase histogram으로 원인을 좁히고, AOI 이웃 수와 snapshot actor 수가 함께 증가했는지 확인한 뒤, 마지막으로 network pending과 retransmit까지 이어지는지 본다.

## Component Relationships

각 subsystem은 hot path에서 자신의 로컬 counter나 histogram만 갱신한다. 일정 metrics window가 끝나면 값을 `MetricSnapshot`으로 만들고 `GlobalExecutor`를 통해 `MetricsAggregator`에 제출한다. 측정 지점이 파일 출력이나 전체 메트릭 저장소를 직접 알 필요가 없도록 수집과 저장을 분리한 구조다.

`MetricSnapshot`의 `scope`, `shardIndex`, `sourceId`는 수치가 어느 실행 범위에 속하는지를 보존한다. 같은 이름의 지표라도 Process 합계, Shard별 값, World별 값은 의미가 다르므로 이 차원을 잃지 않는 것이 중요하다.

Executor metrics도 network, world, process metrics와 같이 metrics window 단위로 `MetricsAggregator`에 제출된다. `GlobalExecutor`는 누적값의 baseline 대비 변화량을, `ShardExecutor`는 metrics window 동안 누적한 값을 metrics snapshot으로 만들어 제출하므로 실행기 부하도 다른 subsystem 신호와 같은 metrics window에서 비교할 수 있다.

## Document Map

1. [[Projects/Jam/Observability/01. Runtime Metrics|Runtime Metrics]] — 계측 지점, metrics snapshot 범위, metrics window 집계와 출력 구조
2. [[Projects/Jam/Observability/02. Performance Validation|Performance Validation]] — 부하 실험을 구간화하고 여러 신호를 함께 해석하는 검증 방법
3. [[Projects/Jam/Observability/03. Metric Catalog|Metric Catalog]] — scope별 metric key, 집계 방식, 해석 기준
