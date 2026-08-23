---
title: Physics
cssclasses:
  - no-meta
---

Jam의 physics layer는 **PhysX의 low-level scene/object API 위에 JamPx의 actor·filter·simulation abstraction을 두고, 이를 JamNet의 world ownership과 execution model에 연결하는 구조**입니다.

JamPx는 PhysX object를 gameplay code에 그대로 노출하기보다 physics archetype, actor body, collision/query policy와 scene lifecycle을 하나의 runtime model로 구성합니다. JamNet은 이 runtime을 `PhysicsFacade`와 execution bridge를 통해 authoritative world simulation에 통합합니다.

```text
Game World
    │
    ▼
PhysicsFacade
    │
    ▼
JamPx Runtime
    ├─ Physics Archetype / Actor Model
    ├─ Collision & Query Policy
    ├─ PhysicsWorld / Scene
    └─ Character / Rigid Simulation
    │
    ▼
PhysX
```

## Core Boundaries

| 영역 | 책임 |
| --- | --- |
| Game World / JamNet | actor identity, authoritative state, tick ordering과 gameplay handoff |
| JamPx | physics archetype, actor representation, filter/query policy, scene abstraction |
| PhysX | scene query, broadphase, contact generation, solver와 CCT primitive |
| Execution Bridge | PhysX CPU task를 shard worker에 제출하고 completion을 owner shard로 연결 |

이 구분에서 중요한 점은 **PhysX object type 자체가 gameplay actor model이 아니라는 것**입니다. 예를 들어 character는 하나의 `PxCapsuleController`만으로 표현되지 않고 CCT, hitbox, locomotion state와 Main/Replay state를 묶은 `CharacterBody`로 다뤄집니다. Rigid actor도 raw `PxRigidActor` 대신 `RigidBody`와 behavior를 통해 static/dynamic/kinematic/projectile의 runtime policy를 구성합니다.

## Document Map

1. [[Projects/Jam/Physics/01. Physics Runtime Model|Physics Runtime Model]] — physics archetype이 JamPx actor와 PhysX object로 구체화되는 과정, character/rigid representation과 scene lifetime
2. [[Projects/Jam/Physics/02. Collision and Query Filtering|Collision and Query Filtering]] — simulation pair, trigger/contact notification과 raycast/sweep/overlap query를 분리하는 filter policy
3. [[Projects/Jam/Physics/03. PhysX Integration and Scheduling|PhysX Integration and Scheduling]] — JamNet world ownership, worker offload, fiber completion과 safe-point readback

세 문서는 서로 다른 경계를 설명합니다. **Runtime Model**은 “무엇을 physics actor로 표현하는가”, **Filtering**은 “무엇과 상호작용하고 query에서 어떻게 보이는가”, **Integration and Scheduling**은 “그 simulation을 JamNet runtime에서 언제·어디서 실행하는가”를 다룹니다.

## Implementation References

- [Physics archetype database와 actor 생성 진입점](https://github.com/akxotjr/Jam/blob/master/JamPx/include/jampx/PhysicsDatabase.h)
- [PhysX scene ownership과 simulation API](https://github.com/akxotjr/Jam/blob/master/JamPx/include/jampx/PhysicsWorld.h)
- [공통 collision filter data](https://github.com/akxotjr/Jam/blob/master/JamPx/include/jampx/PhysicsFilter.h)
- [Simulation pair filtering policy](https://github.com/akxotjr/Jam/blob/master/JamPx/include/jampx/PhysicsSimFilter.h)
- [Raycast, sweep, overlap query policy](https://github.com/akxotjr/Jam/blob/master/JamPx/include/jampx/PhysicsQueryFilter.h)
- [Physics actor materialization](https://github.com/akxotjr/Jam/blob/master/JamPx/include/jampx/actor/ActorFactory.h)
