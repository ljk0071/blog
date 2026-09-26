---
title: '1,000만 건 Excel 다운로드와 OOM: 메모리를 늘리지 않고 구조를 바꾸기'
description: '대용량 Excel 다운로드 시 발생하던 OOM을 Heap 지표로 추적하고, MyBatis Cursor와 SXSSFWorkbook 기반 스트리밍 구조로 바꿔 Heap 사용량을 약 90% 줄인 과정.'
pubDate: 2026-09-22
tags: ['spring', 'mybatis', 'memory', 'scouter', 'troubleshooting']
stage: 'budding'
---

## 문제

대용량 데이터를 Excel로 다운로드하면 **OOM(OutOfMemoryError)** 이 발생하며 서비스가 중단됐습니다.

## 원인: 전부 메모리에 올리고 있었다

Scouter에서 다운로드 요청 동안의 **Heap Used**를 보면, GC가 돌아도 사용량이 줄지 않고 계속 올라가다 OOM으로 끝났습니다.
GC가 회수할 수 없는, 즉 **아직 참조 중인 객체**가 계속 쌓인다는 뜻입니다.

코드를 보니 두 가지가 동시에 메모리를 채우고 있었습니다.

1. DB에서 조회한 **결과 전체**를 List로 적재
2. 생성 중인 **Workbook 전체**(모든 행과 셀)를 메모리에 유지

데이터가 늘수록 두 덩어리가 함께 커지니, 힙을 늘리는 것으로는 결국 한계가 옵니다.

## 해결: 읽는 쪽도, 쓰는 쪽도 스트리밍으로

- **읽기:** MyBatis `Cursor`로 한 행씩 가져와서 결과 전체를 메모리에 올리지 않음
- **쓰기:** `SXSSFWorkbook`으로 일정 행 수만 메모리에 두고 나머지는 임시 파일로 flush

```java
// 개념을 설명하기 위해 단순화한 예시
@Transactional(readOnly = true) // Cursor는 커넥션이 열려 있는 동안만 유효
public void download(OutputStream out) throws IOException {
    try (var workbook = new SXSSFWorkbook(100);        // 메모리에는 최근 100행만
         Cursor<Row> cursor = mapper.streamAll()) {
        var sheet = workbook.createSheet();
        int r = 0;
        for (Row row : cursor) {
            write(sheet.createRow(r++), row);
        }
        workbook.write(out);
    } // SXSSF 임시 파일은 close 시 정리
}
```

## 성과

- Scouter 기준 Heap Used 약 **90% 감소**
- `Xmx 4GB` 운영 환경에서 1회 최대 **1,000만 건** 다운로드까지 검증

## 회고

대용량 처리에서 가장 먼저 떠오르는 방법은 자원을 더 투입하는 것입니다. 하지만 이번에는 **구조를 바꿔서 가진 자원을 최대한 활용하는 것**이 훨씬 멀리 갈 수 있다는 걸 체감했습니다.

> 같은 도구로 전혀 다른 원인(Thread Pool 고갈)을 찾았던 [선착순 정기권 노트](/blog/season-ticket-spike-thread-pool)도 있어요.
