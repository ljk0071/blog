---
title: '선착순 정기권 신청 때마다 서비스가 멈췄다: Thread Pool 고갈 추적기'
description: '정기권 신청 시각의 Spike Traffic으로 서비스가 일시 중단되던 문제를 Scouter로 추적해, BFF–Backend 간 I/O 대기로 인한 Thread Pool 고갈을 찾아내고 격리한 과정.'
pubDate: 2026-09-24
tags: ['spring', 'thread-pool', 'spike-traffic', 'scouter', 'troubleshooting']
stage: 'budding'
---

## 문제

선착순 정기권 신청이 열리는 시각마다 **Spike Traffic**이 몰렸고, 그때마다 서비스가 일시적으로 중단됐습니다.
정기권 API만 느려지는 게 아니라 서비스 전체가 멈춘다는 점이 이상했습니다.

## 원인: 느린 건 정기권인데, 멈춘 건 전부였다

Scouter로 신청 시각 전후의 지표를 봤습니다.

- request elapsed time
- error request
- CPU usage

CPU는 한가한데 elapsed time이 치솟고, 에러는 특정한 순서로 나타났습니다. **`Read Timeout`이 먼저, 그다음 `Connection Timeout`** 이었습니다.

이 패턴을 풀어 보면 다음과 같습니다.

1. BFF 서버의 요청 스레드가 Backend 서버 응답을 기다리며 **I/O 대기**에 묶입니다.
2. 신청이 몰리면서 대기 중인 스레드가 Servlet Thread Pool을 전부 차지합니다. → 먼저 들어온 요청들이 `Read Timeout`
3. 풀이 고갈되니 새 요청은 연결조차 받지 못합니다. → `Connection Timeout`
4. 같은 풀을 쓰는 **다른 모든 API까지** 멈춥니다.

즉 문제는 CPU나 DB가 아니라, 느린 API 하나가 공용 스레드 풀을 독점하는 구조였습니다.

## 해결: 해당 API만 별도 Thread Pool로 격리

정기권 API의 요청을 Servlet Thread가 아닌 **별도의 Thread Pool**에 할당했습니다.
Servlet Thread는 요청을 넘기고 바로 반환되므로, 정기권 신청이 몰려도 다른 API가 쓸 스레드가 남게 됩니다.

```java
// 개념을 설명하기 위해 단순화한 예시
@Bean
ThreadPoolTaskExecutor seasonTicketExecutor() {
    var executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(/* 정기권 전용 */);
    executor.setMaxPoolSize(/* ... */);
    executor.setQueueCapacity(/* ... */);
    executor.setThreadNamePrefix("season-ticket-");
    return executor;
}

@PostMapping("/season-tickets")
CompletableFuture<ResponseEntity<?>> apply(@RequestBody ApplyRequest req) {
    // Servlet Thread는 즉시 반환되고, 실제 처리는 전용 풀에서
    return CompletableFuture.supplyAsync(() -> service.apply(req), seasonTicketExecutor);
}
```

일종의 Bulkhead입니다. 격벽을 세워 한 구역에 물이 차도 배 전체가 가라앉지 않게 하는 방식이죠.

## 성과

- Scouter 기준 elapsed time이 **300ms 밑으로 유지**
- 신청 시각의 서비스 중단 해소

## 회고

선착순 시스템이라고 하면 보통 **동시성 정합성**(중복 신청, 재고 차감)부터 떠올립니다. 이번 일로 그것만으로는 부족하다는 걸 배웠습니다.
Spike Traffic에서 Servlet Thread가 포화되는 구간, 그리고 비동기 처리로 바뀌었을 때의 **사용자 경험**까지 함께 설계해야 합니다.

> 같은 도구(Scouter)로 전혀 다른 병목을 찾았던 [Excel 다운로드 OOM 노트](/blog/excel-download-oom-streaming)도 함께 보면 좋아요.
