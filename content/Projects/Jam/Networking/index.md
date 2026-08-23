---
title: Networking
cssclasses:
  - no-meta
---

Jam networking은 **비동기 transport I/O를 session-owned 실행 흐름으로 넘기고, packet마다 필요한 전달 의미를 선택하는 계층**입니다. Socket은 바이트를 운반하지만 application identity나 state ownership을 뜻하지 않습니다. 인증과 binding을 마친 logical session이 protocol state를 소유합니다.

> **Mental model**  
> Transport는 데이터를 이동시키고, session은 identity와 lifetime을 소유하며, channel은 recency·reliability·ordering 요구를 표현합니다.

이 문서군에서는 전송 단위를 다음 용어로 구분합니다.

| 용어 | 의미 |
| --- | --- |
| Application message | RPC, system event처럼 handler가 해석하는 의미 단위 |
| Logical packet | fragmentation 전 또는 reassembly 후의 header + payload 단위 |
| Wire packet | 실제 전송 pipeline이 처리하는 packet 단위; fragment 하나도 개별 wire packet |
| UDP datagram | UDP send/receive 경계이며 하나 이상의 wire packet을 bundle할 수 있는 transport 단위 |

## Overview

```text
Application payload
    -> packet type + delivery channel
    -> session-owned outgoing pipeline
    -> TCP stream / UDP datagram
    -> IOCP completion
    -> endpoint or SessionId routing
    -> owner shard handoff
    -> session-owned incoming pipeline
    -> RPC / system / domain handler
```

IOCP worker는 transport completion을 진행하지만 sequence, ACK, RPC, session lifetime state를 직접 변경하지 않습니다. Endpoint 또는 bound `SessionId`로 owner shard를 찾은 뒤 그 shard에서 protocol pipeline을 실행합니다. 이 경계는 [[../Execution Model/index|Execution Model]]의 owner-local serial execution을 networking에 적용한 것입니다.

## Core Concepts

### Socket and Session Separation

TCP connection이나 UDP endpoint는 transport 식별자입니다. 인증된 principal, authoritative `SessionId`, owner shard가 확정되어야 application traffic을 처리할 logical session이 됩니다. UDP는 endpoint 기반 pre-bind route에서 시작해 binding 뒤 `SessionId` route로 승격됩니다.

### Transport and Delivery Semantics

TCP는 reliable ordered byte stream이며 bootstrap과 제어 흐름의 기준선입니다. UDP는 datagram boundary와 낮은 지연을 제공하고, channel을 통해 best effort·최신성·선택적 신뢰성·순서를 조합합니다. Application은 socket 구현이 아니라 payload 의미에 맞는 channel을 선택합니다.

### Wire Processing and Domain Dispatch

Framing, header validation, sequence 처리, transport ACK, fragmentation/reassembly, ordering은 공통 pipeline에서 처리합니다. Packet layer는 application message의 의미를 모르며, 완성되고 검증된 logical packet만 system, RPC, custom handler로 전달합니다.

## Documents

1. [[01. Connection and Session Lifecycle|Connection and Session Lifecycle]] — transport endpoint가 인증되고 shard-owned logical session이 되어 종료되기까지
2. [[02. Transport and Delivery Semantics|Transport and Delivery Semantics]] — message 의미에서 필요한 recency·reliability·ordering contract를 선택하는 기준
3. [[03. Packet Processing Pipeline|Packet Processing Pipeline]] — application payload와 wire 사이의 송수신 stage 및 execution boundary
4. [[04. Reliable Datagram Delivery|Reliable Datagram Delivery]] — 선택된 reliable contract를 UDP 위에서 ACK, retransmission과 congestion control로 구현하는 방법
5. [[05. Packet Framing and Fragmentation|Packet Framing and Fragmentation]] — packet boundary, 가변 header, TCP assembly, UDP MTU와 reassembly
