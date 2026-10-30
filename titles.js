// 칭호 시스템 데이터 + 판정 엔진. 문구·칭호는 아래 TITLE_UI / TITLES 만 고치면 된다(저장·팝업·목록은 자동 반영).
// 칭호: {id(영문 소문자/숫자/하이픈, 출시 후 변경 금지), name, flavor(팝업 큰 대사), sub(선택 보조 한 줄), desc(획득 조건), hint(잠김 힌트, 생략 시 desc),
//        tier('common'|'rare'|'epic'|'legend'), secret(true 면 잠김 상태에서 조건 숨김), cond(선언형 조건)}
// cond 종류(TITLE_CONDS): draws repeat sameCardCount dupTotal dupStreak newStreak gradeStreak gradeDraw gradeAtLeast drought gradeComplete allComplete collectionPercent hour dayDraws all not{cond}
//   + 이번 뽑기 전용: thisGrade{grades} isNew{} isDup{} firstDraw{} droughtBeforeThis{grade,n}  (통계는 모두 이번 뽑기를 반영한 값)
// 한마디(QUIPS): 매 뽑기 결과 화면에 한 줄. rules[{id,pri,when(cond, 생략 시 항상),p(0~1, 생략 시 1: 맞아도 이 확률로만 적용),pool}] 중 when 이 참이고 p 를 통과한 것 가운데 pri 가 가장 높은 규칙들의 pools[pool] 에서 랜덤 1줄,
//   없으면 pools[fallbackPools[등급]]. (규칙에 pool 대신 lines:[...] 를 바로 적어도 된다.)
// <titles-data> (아래 세 상수는 기획 데이터(titles_spec.json)에서 생성됨)
export const TITLE_UI = {
  "toastHeader": "칭호 획득!",
  "toastLine": "새로운 칭호 [ {name} ] 를 획득했습니다!",
  "toastGoList": "칭호 목록 ›",
  "listTitle": "칭호 목록",
  "listCount": "획득 {n} / {total}",
  "lockedLabel": "미획득",
  "secretHint": "???",
  "lockedHiddenName": "???",
  "titleListSubtitle": "조건은 비밀입니다. 뽑다 보면 알게 됩니다.",
  "quipLabel": "",
  "emptyNote": "아직 획득한 칭호가 없어요. 카드를 뽑아 보세요!",
  "tabCards": "카드 목록",
  "tabTitles": "칭호 목록",
  "tierLabels": {
    "common": "일반",
    "rare": "희귀",
    "epic": "영웅",
    "legend": "전설"
  },
  "earnedOn": "{date} 획득",
  "moreNote": "외 {n}개의 칭호를 더 획득했어요"
};
export const QUIPS = {
  rules: [
    {"id": "first-draw", "pri": 100, "when": {"type": "all", "conds": [{"type": "firstDraw"}, {"type": "not", "cond": {"type": "thisGrade", "grades": ["SSS"]}}]}, "pool": "first-draw"},
    {"id": "sss-streak", "pri": 99, "when": {"type": "gradeStreak", "grades": ["SSS"], "n": 2}, "pool": "sss-streak"},
    {"id": "sss-after-drought", "pri": 98, "when": {"type": "all", "conds": [{"type": "thisGrade", "grades": ["SSS"]}, {"type": "droughtBeforeThis", "grade": "SSS", "n": 40}]}, "pool": "sss-after-drought"},
    {"id": "sss-first", "pri": 97, "when": {"type": "all", "conds": [{"type": "thisGrade", "grades": ["SSS"]}, {"type": "gradeDraw", "grades": ["SSS"], "n": 1}, {"type": "not", "cond": {"type": "gradeDraw", "grades": ["SSS"], "n": 2}}]}, "pool": "sss-first"},
    {"id": "sss-dup", "pri": 96, "when": {"type": "all", "conds": [{"type": "thisGrade", "grades": ["SSS"]}, {"type": "isDup"}]}, "pool": "sss-dup"},
    {"id": "sss-any", "pri": 95, "when": {"type": "thisGrade", "grades": ["SSS"]}, "pool": "fb-SSS"},
    {"id": "milestone-10", "pri": 90, "when": {"type": "all", "conds": [{"type": "draws", "n": 10}, {"type": "not", "cond": {"type": "draws", "n": 11}}]}, "pool": "milestone-10"},
    {"id": "milestone-50", "pri": 90, "when": {"type": "all", "conds": [{"type": "draws", "n": 50}, {"type": "not", "cond": {"type": "draws", "n": 51}}]}, "pool": "milestone-50"},
    {"id": "milestone-100", "pri": 90, "when": {"type": "all", "conds": [{"type": "draws", "n": 100}, {"type": "not", "cond": {"type": "draws", "n": 101}}]}, "pool": "milestone-100"},
    {"id": "milestone-300", "pri": 90, "when": {"type": "all", "conds": [{"type": "draws", "n": 300}, {"type": "not", "cond": {"type": "draws", "n": 301}}]}, "pool": "milestone-300"},
    {"id": "repeat-2", "pri": 85, "when": {"type": "repeat", "n": 2}, "pool": "repeat-2"},
    {"id": "repeat-1", "pri": 80, "when": {"type": "repeat", "n": 1}, "pool": "repeat-1"},
    {"id": "near-miss", "pri": 75, "when": {"type": "all", "conds": [{"type": "thisGrade", "grades": ["S", "SS"]}, {"type": "drought", "grade": "SSS", "n": 15}, {"type": "droughtBeforeThis", "grade": "S", "n": 6}]}, "pool": "near-miss"},
    {"id": "after-low-streak", "pri": 70, "when": {"type": "droughtBeforeThis", "grade": "A", "n": 6}, "pool": "after-low-streak"},
    {"id": "c-streak-12", "pri": 68, "when": {"type": "all", "conds": [{"type": "gradeStreak", "grades": ["C"], "n": 12}, {"type": "not", "cond": {"type": "gradeStreak", "grades": ["C"], "n": 13}}]}, "pool": "c-streak-12"},
    {"id": "c-streak-8", "pri": 66, "when": {"type": "all", "conds": [{"type": "gradeStreak", "grades": ["C"], "n": 8}, {"type": "not", "cond": {"type": "gradeStreak", "grades": ["C"], "n": 9}}]}, "pool": "c-streak-8"},
    {"id": "c-streak-5", "pri": 64, "when": {"type": "all", "conds": [{"type": "gradeStreak", "grades": ["C"], "n": 5}, {"type": "not", "cond": {"type": "gradeStreak", "grades": ["C"], "n": 6}}]}, "pool": "c-streak-5"},
    {"id": "b-streak-5", "pri": 64, "when": {"type": "all", "conds": [{"type": "gradeStreak", "grades": ["B"], "n": 5}, {"type": "not", "cond": {"type": "gradeStreak", "grades": ["B"], "n": 6}}]}, "pool": "b-streak-5"},
    {"id": "c-streak-3", "pri": 62, "when": {"type": "all", "conds": [{"type": "gradeStreak", "grades": ["C"], "n": 3}, {"type": "not", "cond": {"type": "gradeStreak", "grades": ["C"], "n": 4}}]}, "pool": "c-streak-3"},
    {"id": "b-streak-3", "pri": 62, "when": {"type": "all", "conds": [{"type": "gradeStreak", "grades": ["B"], "n": 3}, {"type": "not", "cond": {"type": "gradeStreak", "grades": ["B"], "n": 4}}]}, "pool": "b-streak-3"},
    {"id": "c-streak-2", "pri": 60, "when": {"type": "all", "conds": [{"type": "gradeStreak", "grades": ["C"], "n": 2}, {"type": "not", "cond": {"type": "gradeStreak", "grades": ["C"], "n": 3}}]}, "pool": "c-streak-2"},
    {"id": "b-streak-2", "pri": 60, "when": {"type": "all", "conds": [{"type": "gradeStreak", "grades": ["B"], "n": 2}, {"type": "not", "cond": {"type": "gradeStreak", "grades": ["B"], "n": 3}}]}, "pool": "b-streak-2"},
    {"id": "low-streak-10", "pri": 59, "when": {"type": "all", "conds": [{"type": "drought", "grade": "A", "n": 10}, {"type": "not", "cond": {"type": "drought", "grade": "A", "n": 11}}]}, "pool": "low-streak-10"},
    {"id": "low-streak-5", "pri": 58, "when": {"type": "all", "conds": [{"type": "drought", "grade": "A", "n": 5}, {"type": "not", "cond": {"type": "drought", "grade": "A", "n": 6}}]}, "pool": "low-streak-5"},
    {"id": "dup-streak-6", "pri": 56, "when": {"type": "all", "conds": [{"type": "dupStreak", "n": 6}, {"type": "not", "cond": {"type": "dupStreak", "n": 7}}]}, "pool": "dup-streak-6"},
    {"id": "dup-streak-3", "pri": 55, "when": {"type": "all", "conds": [{"type": "dupStreak", "n": 3}, {"type": "not", "cond": {"type": "dupStreak", "n": 4}}]}, "pool": "dup-streak-3"},
    {"id": "new-streak-3", "pri": 55, "when": {"type": "all", "conds": [{"type": "newStreak", "n": 3}, {"type": "not", "cond": {"type": "newStreak", "n": 4}}]}, "pool": "new-streak-3"},
    {"id": "drought-sss-100", "pri": 54, "when": {"type": "all", "conds": [{"type": "drought", "grade": "SSS", "n": 100}, {"type": "not", "cond": {"type": "drought", "grade": "SSS", "n": 101}}]}, "pool": "drought-sss-100"},
    {"id": "drought-sss-70", "pri": 53, "when": {"type": "all", "conds": [{"type": "drought", "grade": "SSS", "n": 70}, {"type": "not", "cond": {"type": "drought", "grade": "SSS", "n": 71}}]}, "pool": "drought-sss-70"},
    {"id": "drought-sss-40", "pri": 52, "when": {"type": "all", "conds": [{"type": "drought", "grade": "SSS", "n": 40}, {"type": "not", "cond": {"type": "drought", "grade": "SSS", "n": 41}}]}, "pool": "drought-sss-40"},
    {"id": "drought-sss-20", "pri": 51, "when": {"type": "all", "conds": [{"type": "drought", "grade": "SSS", "n": 20}, {"type": "not", "cond": {"type": "drought", "grade": "SSS", "n": 21}}]}, "pool": "drought-sss-20"},
    {"id": "drought-sss-10", "pri": 50, "when": {"type": "all", "conds": [{"type": "drought", "grade": "SSS", "n": 10}, {"type": "not", "cond": {"type": "drought", "grade": "SSS", "n": 11}}]}, "pool": "drought-sss-10"},
    {"id": "drought-sss-5", "pri": 49, "when": {"type": "all", "conds": [{"type": "drought", "grade": "SSS", "n": 5}, {"type": "not", "cond": {"type": "drought", "grade": "SSS", "n": 6}}]}, "pool": "drought-sss-5"},
    {"id": "many-today", "pri": 31, "when": {"type": "all", "conds": [{"type": "dayDraws", "n": 20}, {"type": "thisGrade", "grades": ["C", "B", "A"]}]}, "pool": "many-today", "p": 0.4},
    {"id": "night", "pri": 30, "when": {"type": "all", "conds": [{"type": "hour", "from": 0, "to": 5}, {"type": "thisGrade", "grades": ["C", "B", "A"]}]}, "pool": "night", "p": 0.5},
    {"id": "new-card", "pri": 21, "when": {"type": "all", "conds": [{"type": "isNew"}, {"type": "thisGrade", "grades": ["C", "B", "A"]}]}, "pool": "new-card", "p": 0.4},
    {"id": "dup", "pri": 20, "when": {"type": "all", "conds": [{"type": "isDup"}, {"type": "thisGrade", "grades": ["C", "B", "A"]}]}, "pool": "dup", "p": 0.35}
  ],
  fallbackPools: {"C": "fb-C", "B": "fb-B", "A": "fb-A", "S": "fb-S", "SS": "fb-SS", "SSS": "fb-SSS"},
  pools: {
    "fb-C": ["엄.", "줴줴이야.", "음.", "그렇군요.", "읭.", "에또…", "응 C.", "네 다음 분", "아 예 C요", "흠…", "어… 네.", "C.", "배송조회: C가 문 앞에 도착했습니다.", "오늘의 운세: 흐림 때때로 C입니다.", "건강검진 결과: 운 수치가 C입니다.", "맞춤법 검사: 'C'는 올바른 표기입니다.", "내비게이션: 경로를 이탈하여 C로 안내합니다.", "알림톡: 귀하의 C가 도착했습니다.", "영수증: C 1매, 기대감 0원. 합계 0원.", "경고: 이 카드는 안전합니다. 너무 안전합니다.", "ARS: 재도전은 1번, 현실 직시는 2번입니다.", "출석체크 완료. 오늘의 보상은 C입니다.", "심사평: 무난함의 극치. 가점도 감점도 없음.", "시스템: 경험치 +1, 기대치 -1.", "약관 제3조: C는 환불되지 않습니다.", "C가 나왔습니다. 심호흡하고 다시 누르십시오.", "카드가 최선을 다하지 않았습니다.", "방금 그 카드는 CCTV에 기록되었습니다.", "C를 뽑으셨습니다. 이웃에게 알리지 않겠습니다.", "치이카와가 조용히 눈을 피했습니다.", "하치와레가 말없이 어깨를 두드립니다.", "C입니다. 귀엽긴 합니다.", "기대하지 않으셨다면 성공입니다.", "일기예보: 다음 뽑기도 C 확률 40%.", "서비스로 드립니다. 아무도 원치 않았지만.", "편의점이라도 들르세요. C입니다."],
    "fb-B": ["음, B.", "B네요.", "오, B.", "그럭저럭.", "네 B요.", "무난.", "B입니다. 잘하지도 못하지도 않았습니다.", "반장 선거로 치면 부반장급 결과입니다.", "B. 미지근한 물 같은 결과입니다.", "성적표: 수우미양가 중 '우'입니다.", "심사평: 무난. 무난. 그리고 무난.", "B입니다. 이력서에 쓰기엔 애매합니다.", "배송 중 B가 길을 헤맸습니다. 목적지는 A.", "내비게이션: 목적지 근처입니다. 안내를 종료합니다.", "중간만 가라는 말을 실천하셨습니다.", "점심 메뉴로 치면 김치찌개입니다.", "건강검진 결과: 경과 관찰 요망.", "맞춤법 검사: 'B'는 'A'의 오타일 수 있습니다.", "카드가 눈치껏 B를 드렸습니다.", "치이카와가 박수를 쳤습니다. 작게.", "우사기가 '야하!' 했습니다. B와 무관합니다.", "ARS: B 확인은 1번, 아쉬움은 2번입니다.", "A와 C 사이 어딘가, 지금 여기입니다.", "시스템: 평범한 아이템을 획득했습니다.", "자랑은 마음속으로만 하십시오.", "구독 안내: B 플랜은 무난하게 유지됩니다."],
    "c-streak-2": ["또 C입니다.", "같은 C가 재방송 중입니다.", "C 1+1 행사가 진행 중입니다.", "방금 그 카드가 복사 붙여넣기 되었습니다.", "또 오셨네요. C가요.", "2연속 C. 우연이라고 믿고 싶습니다.", "C: 아 안녕하세요, 또 저예요.", "재입고된 C입니다.", "앵콜 요청이 접수되었습니다. C 앵콜.", "아까 그 C가 맞습니다.", "복습하셨습니다. C를요."],
    "c-streak-3": ["삼세번 C. 이제 의리입니다.", "C 3연속. 트리플 C 달성입니다.", "C가 세 장 모였습니다. 소원은 안 들어줍니다.", "3연속입니다. 확률 선생님이 고개를 갸웃합니다.", "C 트리오 결성. 첫 앨범은 없습니다.", "C 3장 세트 구매 감사합니다.", "세 번째 만남입니다. C가 낯을 안 가립니다.", "C: 제가 사람을 좋아해서요.", "삼세판 규칙 적용. C 승.", "C와 연락처를 교환하셨습니다. 3연속."],
    "c-streak-5": ["다섯 번째 C입니다. 기념품은 없습니다.", "5연속 C. 통계학자가 커피를 내려놓았습니다.", "C와 다섯 번 만났습니다. 사귀는 사이입니다.", "C 오형제 완성. 막내는 방금 도착했습니다.", "5연속 C. 이건 운이 아니라 성실함입니다.", "손가락을 다 접었습니다. C로요.", "확인 결과 기계 이상 아님. 5연속 C.", "C가 현관 비밀번호를 외웠습니다.", "C 개근상 수상. 5회 연속 출석.", "카드팩이 조용히 눈을 감았습니다."],
    "c-streak-8": ["C가 짐을 풀었습니다. 8연속입니다.", "여덟 번째 C. 이름 지어주셨나요?", "8연속 C. 명절에 같이 내려가십시오.", "확률 책이 덮였습니다. 8연속.", "C가 칫솔을 가져왔습니다.", "C와 동거 8회차입니다.", "C: 저희 이제 말 놔도 되죠?", "8연속. 포기가 아니라 수행입니다."],
    "c-streak-12": ["C 12연속. 가훈이 C로 바뀌었습니다.", "C 열두 장. 한 타스 구매 감사합니다.", "C가 가족관계증명서에 올라갑니다.", "12연속 C. 이건 운이 아니라 신앙입니다.", "C가 놓아주지 않습니다. 계약서에 없던 일입니다.", "카드팩이 미안하다고 합니다. 12번째입니다.", "12연속. A가 실존하는지 의심됩니다.", "서버 담당자가 식은땀을 흘립니다. C 12연속.", "C 돌잔치 날짜를 잡으시죠."],
    "b-streak-2": ["또 B입니다.", "B가 앵콜 나왔습니다.", "A는 부재중입니다. 메모를 남기십시오.", "B 2연속. 한결같음에 박수.", "같은 B가 재방송 중입니다.", "B 1+1. 옆 카드는 서비스입니다.", "A에게 전화했으나 받지 않습니다.", "복사 붙여넣기 하셨나요? B로."],
    "b-streak-3": ["삼세번 B. A 쪽으로 한 걸음 부족합니다.", "B가 단골 등록을 마쳤습니다.", "A는 통화 중입니다. 계속.", "B 트리플. 평균이 당신을 닮았습니다.", "3연속 B. 안정적 운영 중입니다.", "A는 약속 장소에 나오지 않았습니다. 세 번째.", "중간만 가는 것도 재능입니다.", "B 세 장이면 A 한 장인가요? 아닙니다."],
    "b-streak-5": ["B 5연속. A는 연락두절입니다.", "A 실종 신고가 접수되었습니다. B만 5장.", "B 오형제 완성. 장남 A는 가출했습니다.", "그래도 C는 아닙니다. 위안입니다.", "B 고정석에 명패를 달아드립니다.", "SSS는 전설이고 A는 소문입니다. B는 현실.", "확률 담당자가 중간 보고서를 씁니다. 전부 B.", "B 열 장 모으면 A 하나 주나요? 안 줍니다."],
    "low-streak-5": ["하위 등급 5연속. 상위 등급은 다음 기회에.", "상위 등급 창구는 점심시간입니다.", "위쪽 등급은 현재 공사 중입니다.", "A 이상은 현재 재고 없음입니다.", "S 이상 카드는 입고 대기 중입니다.", "다섯 번 모두 평범했습니다. 일관성 인정.", "B와 C로 골고루 드셨습니다.", "상위 등급이 단체로 휴가를 냈습니다.", "카드팩이 몸을 사리고 있습니다.", "위쪽 등급은 줄이 너무 깁니다."],
    "low-streak-10": ["10연속 하위 등급. 상위 등급은 다음 생에.", "열 장 연속 평지입니다. 등산화 벗으세요.", "A 이상은 소문으로만 확인됩니다.", "확률 담당자와의 면담을 요청합니다.", "위쪽 등급이 미안해하고 있습니다.", "S는 무단결석 중입니다. 사유서도 없습니다.", "지도에서 상위 등급 구역이 삭제되었습니다.", "위쪽 등급이 1층 로비에서 대기 중입니다."],
    "first-draw": ["회원가입을 환영합니다. 약관 동의는 완료되었습니다.", "첫 뽑기는 무료입니다. 두 번째부터는 의지입니다.", "신규 가입 축하합니다. 환불 규정은 없습니다.", "처음 오셨군요. 운은 여기서 잠시 맡아두겠습니다.", "초보 운전 스티커가 부착되었습니다.", "첫 방문 감사합니다. 나가시는 길은 없습니다.", "카드팩 개봉 의식을 시작합니다. 박수.", "치이카와가 처음 뵙겠다고 합니다."],
    "fb-A": ["A 등급입니다. 대부분의 사람은 여기서 만족합니다.", "A 입장하셨습니다. S 입구는 한 층 위입니다.", "A 확정. 자랑하기엔 조금 애매한 높이입니다.", "[속보] A 출현. 전문가들은 놀라지 않았습니다.", "영수증: A 1장, 무난함 1개, 설렘 0.5개.", "건강검진 결과: 운 양호, 욕심 과다.", "A 등급 상품은 환불이 불가합니다. 자랑은 가능합니다.", "맞춤법 검사: 'A'는 'S'의 오타가 아닙니다.", "오늘의 운세: 중상. 상은 아닙니다.", "A 카드가 문 앞에 도착했습니다. 초인종은 안 눌렀습니다.", "내일 날씨 맑음. 지금 뽑기 운세는 A 정도.", "치셨습니다! 2루타입니다. 홈런은 다음 타석에서.", "구독 알림: A 혜택이 활성화되었습니다. 혜택은 없습니다.", "브라우저 경고: 이 A는 S로 오인될 수 있습니다.", "내비게이션: 목적지 S까지 한 정거장 남았습니다.", "ARS: 만족하시면 1번, 더 뽑으시려면 이미 누르고 계십니다.", "심사평: 기술점수 높음, 예술점수 평범. 총평 A.", "A 획득. 치이카와가 박수를 쳤습니다. 작게.", "상위 33%입니다. 세 명 중 한 명은 이깁니다.", "A입니다. 성적표였다면 부모님이 웃으셨을 겁니다.", "A 카드 한 장 포장해 드릴까요? 아, 화면이군요.", "A 확인. 지갑이 희망을 품기 시작합니다.", "A입니다. 엘리베이터 최상층 바로 아랫층입니다.", "A라니. 오늘 카드팩이 기분이 좋은가 봅니다.", "축하합니다. A는 '아깝지 않은' 등급의 A입니다.", "A 도착. 이 정도면 입가에 미소가 번져도 됩니다."],
    "fb-S": ["S 등장! 호들갑 떨기 딱 좋은 등급입니다.", "S입니다. 이쯤에서 SS가 눈을 뜨기 시작합니다.", "[속보] S 출현. 시청자 여러분 일단 앉으세요.", "S 획득. 자랑 가능 범위에 정식 진입했습니다.", "S입니다. 오늘 하루는 기분 좋아도 됩니다.", "S 등급 확인. 설마 SSS는 아니죠? 네, 아닙니다.", "상위 16%입니다. 나머지 84%는 모른 척합니다.", "카드팩 컨디션 최상. 이유는 불명입니다.", "일기예보: S가 한 줄기 내린 뒤 다시 C로 돌아오겠습니다.", "영수증: S 1장, 기대감 +30%, 현실감각 -30%.", "S를 뽑으셨습니다. 이제 B랑은 말도 섞지 마세요.", "S 등급 합격입니다. 장학금은 없습니다.", "큽니다! 펜스 직격! 담장은 못 넘겼습니다. 그래도 S!", "S 확정. 맞춤법 검사기도 '대박'을 제안합니다.", "S 승객은 SSS 승강장까지 걸어가셔야 합니다.", "S입니다. 손가락에 공로 훈장을 수여합니다.", "S 입장. 도감이 모처럼 반짝거립니다.", "건강검진 결과: S 정상. 욕심 수치만 이상.", "[Web발신] 고객님의 S가 도착했습니다.", "S 개봉. 이번 달 행운 잔액이 부족합니다.", "S 이용권이 이번 한 번에 한해 지급되었습니다.", "S입니다. 주변에 알리세요. 반응은 보장하지 않습니다.", "내비: 정상까지 두 구간 남았습니다. 전방 정체.", "S 카드 등장. 지갑이 잠깐 웃었습니다.", "브라우저: 이 S는 곧 만료될 운일 수 있습니다.", "S 확정. 이 맛에 뽑는 거죠. 그리고 곧 후회하는 거죠."],
    "fb-SS": ["SS 등장! 전 국민이 놀랐습니다. 저만 놀랐습니다.", "SS입니다. 정상 바로 아래 층, 전망이 좋습니다.", "[긴급] SS 발견. SSS는 다른 일정이 있다고 합니다.", "SS 달성! 축하 현수막이 도착했습니다. 글씨가 작습니다.", "상위 6%입니다. 2%는 아직 문 앞에서 기다립니다.", "SS라니. 이쯤 되면 운이 아니라 실력입니다. 아닙니다.", "영수증: SS 1장. 사용된 운 87%. 환불 불가.", "SS 확정. 이 순간만큼은 S도 박수 칩니다.", "넘어갑니다! 파울 폴대 옆으로... 아닙니다, SS입니다!", "SS 도착. 택배 기사님이 사진을 찍어 가셨습니다.", "일기예보: SS 소나기 후 곧 C 쾌청이 예상됩니다.", "SS 입장 완료. 에스컬레이터는 여기까지입니다.", "SS입니다. 이제 SSS 번호표는 한 장 남았습니다.", "SS를 뽑으셨습니다. 어머님께 전화할 수준은 아닙니다.", "건강검진 결과: 운 수치 SS. 심박수도 SS.", "SS. 딱 이 정도가 자랑하기 가장 마음 편합니다.", "SS 등급입니다. 세계 신기록은 아니고 세계 기분입니다.", "맞춤법 검사: 'SS' 올바른 표현. 'SSS'는 저장 안 됨.", "SS 승객은 SSS 승강장으로 이동하십시오. 환승 불가.", "SS입니다. 카드팩 직원이 잠깐 일어섰습니다.", "SS 개봉. 손가락 보험 가입을 권장합니다.", "[Web발신] 고객님의 SS가 도착했습니다. 놀라지 마세요.", "SS입니다. 이 정도면 오늘은 접어도 됩니다.", "SS 확인. 소름 돋았습니다. 에어컨 탓일 수도 있습니다.", "SS 나와서 해지하려던 구독을 유지합니다.", "내비: SSS까지 1단계. 그 1단계가 대륙입니다."],
    "near-miss": ["SSS가 코앞입니다. 코앞에서 멈췄습니다.", "드디어 카드팩이 일을 합니다. 반만 합니다.", "한참 만의 고등급! 네, 최고는 아닙니다.", "거의 다 왔는데 집에 가셨습니다.", "SSS 가뭄 속 단비. 양동이로 받을 양은 아닙니다.", "기다림의 끝에 도착한 건 SSS의 사촌이었습니다.", "SSS인 줄 알았죠? 저도 속았습니다.", "고점 갱신! 천장은 그대로!", "그 오랜 기도에 카드팩이 중간 답장을 보냈습니다.", "드디어 사람 구실을 합니다. 반 사람 구실.", "SSS의 대타가 도착했습니다. 성적은 준수합니다.", "SSS는 아직 휴가 중. 대신 이분이 출근했습니다.", "전설의 예고편만 시청하셨습니다.", "확률이 눈치를 보기 시작했습니다. 사과는 아직입니다.", "오랜 가뭄 끝에 비가 왔습니다. 이슬비입니다.", "SSS의 그림자를 밟았습니다. 본체는 아닙니다.", "기다림에 대한 보상: 위로상 수상.", "일기예보: SSS 구름 접근 중. 오늘은 비 안 옵니다."],
    "after-low-streak": ["C와 B의 긴 터널을 지나 빛이 보입니다. 전구 수준입니다.", "드디어 카드팩이 일을 합니다. 출근이 늦었습니다.", "한참 만의 좋은 카드! 주변 C들이 놀라 쳐다봅니다.", "하위 등급 장기 투숙 종료. 체크아웃을 환영합니다.", "오랜만입니다, 사람 구실. 잘 지내셨나요?", "인내의 결실입니다. 아주 작은 열매입니다.", "C의 감옥에서 가석방되었습니다. 모범수였습니다.", "카드팩이 미안하긴 했나 봅니다.", "실종 신고하신 운이 발견되었습니다.", "고생 많으셨습니다. 이번만 기뻐해 드립니다."],
    "repeat-1": ["아까 보신 그분입니다. 퇴근을 안 하셨습니다.", "또 너입니까. 방금 뵈었는데요.", "방금 본 얼굴입니다. 복사 붙여넣기 아닙니다.", "카드팩이 앞 장을 복사했습니다. 확인 부탁드립니다.", "재방송입니다. 방금 보신 내용과 동일합니다.", "새로고침 하셨습니까? 같은 카드입니다.", "동일 카드 연속 발견. 카드팩이 할 말을 잃었습니다.", "앞 카드가 뒤돌아 다시 나왔습니다. 심심하셨나 봅니다.", "맞춤법 검사: 중복된 단어. 중복된 카드입니다.", "택배 오배송: 같은 상품이 한 번 더 도착했습니다.", "이 카드가 당신을 너무 좋아합니다.", "방금 그 카드가 줄을 다시 섰습니다.", "또 만났군요. 우리 인연이 이렇게 짧을 줄이야. 아니, 깁니다.", "같은 투수, 같은 공, 같은 결과입니다.", "구독 중인 카드입니다. 해지는 안 됩니다.", "다시 한 번 뵙게 되어 반복적으로 영광입니다.", "중복 오류가 아닙니다. 정상입니다. 그래서 더 문제입니다."],
    "repeat-2": ["3연속 같은 카드. 가족사진 찍으셔야 합니다.", "세 번째 만남입니다. 이 카드가 이사 왔습니다.", "같은 카드 3연속. 확률이 눈을 가렸습니다.", "카드팩 오류 신고 접수 완료. 오류가 아닙니다.", "삼세번입니다. 이 카드는 당신의 룸메이트입니다.", "고객님, 의도하신 겁니까? 카드가 의도한 듯합니다.", "이 카드의 3연속 출연료를 청구해야 합니다.", "3연속 동일. 우주가 복사 붙여넣기 중입니다.", "또, 또, 또. 세 번 쓰면 이름이 되는 법입니다.", "삼연속 동일 카드. 도감이 어리둥절합니다."],
    "dup": ["대단합니다. 또 똑같습니다.", "이미 가지고 계십니다. 한 장 더 가지셔도 됩니다.", "중복 카드 접수. 장롱에 쌓이는 중입니다.", "도감 알림: 이분은 이미 입주해 계십니다.", "이 카드는 이미 서랍에 있습니다. 두 번째 서랍을 마련하세요.", "중복 감지. 기쁨은 처음 한 번만 제공됩니다.", "이미 아는 얼굴입니다. 이름도 알고 계시죠.", "복습 시간입니다. 이 카드, 시험에 나옵니다.", "같은 카드 두 장째. 스페어가 생겼습니다. 쓸 일은 없습니다.", "도감 변동 없음. 지갑 변동 있음.", "이미 만난 카드입니다. 동창회 느낌입니다.", "맞춤법 검사: 이미 존재하는 항목입니다.", "영수증: 이미 보유한 상품, 재구매 확인.", "내비: 방금 지나친 길로 다시 진입했습니다.", "중복입니다. 나눔은 불가합니다. 아직은.", "이번 열차는 이미 타신 열차입니다."],
    "dup-streak-3": ["중복 3연속. 도감이 문을 닫았습니다.", "새 얼굴은 어디에? 전부 아는 얼굴뿐입니다.", "3연속 중복. 이쯤 되면 도감이 먼저 지칩니다.", "3연속 재방송. 채널 돌릴 곳이 없습니다.", "세 번 연속 아는 카드. 기억력 테스트 만점입니다.", "신규 카드 실종 신고서를 작성해 주십시오.", "중복이 중복을 부르는 중입니다.", "도감 알림: 3회 연속 변경사항 없음. 평화롭습니다."],
    "dup-streak-6": ["6연속 중복. 도감에 서리가 앉았습니다.", "여섯 번째 아는 카드. 도감이 파업을 선언했습니다.", "6연속 중복. 신규 카드가 당신을 피하는 중입니다.", "6연속 중복 달성. 이쯤이면 수집이 아니라 복습입니다.", "새 카드가 안 나오는 게 아니라 숨은 겁니다. 아마도.", "6연속 재고 정리 중. 새 상품은 입고 대기입니다.", "도감이 말합니다. '나 아직 빈칸 많은데...'", "여섯 번의 복습으로 전 카드를 외우셨습니다. 수석입니다."],
    "new-card": ["도감 등록 완료. 새 식구가 입주했습니다.", "처음 뵙겠습니다. 앞으로 잘 부탁드립니다.", "신규 카드 발견! 도감 빈칸이 하나 줄었습니다.", "낯선 얼굴입니다. 환영 파티는 도감 안에서.", "새 카드는 언제나 설렙니다. 두 번째부터는 아닙니다.", "택배 도착: 처음 보는 카드. 반품 불가.", "신규 입주자 확인. 이삿짐은 없습니다.", "도감 업데이트 완료. 지갑 업데이트는 별도입니다.", "이 카드는 처음입니다. 그리고 기분은 좋습니다.", "새로운 만남이 시작되었습니다. 중복이 될 때까지만.", "기록: 최초 발견. 학계가 주목하고 있습니다.", "처음 보는 얼굴. 이름표부터 달아드립니다."],
    "new-streak-3": ["신규 3연속. 도감이 갑자기 바빠졌습니다.", "3연속 처음 보는 카드. 카드팩이 오늘 후하네요.", "새 얼굴 세 명 연속 입장. 도감 문이 닳습니다.", "신규 3연속. 중복의 신이 자리를 비웠습니다.", "연속 신규 등록. 도감 담당자가 야근합니다.", "세 장 모두 처음입니다. 운이 아니라 도감 설계입니다.", "3연속 신입사원 입사. 연수는 없습니다.", "신규의 연속. 이 흐름은 오래 못 갑니다. 아마도."],
    "milestone-10": ["10번째 뽑기입니다. 슬슬 시작하신 느낌이 드네요.", "10회 달성. 지갑이 조용히 상황을 파악 중입니다.", "10번째. 아직은 취미라고 부를 수 있습니다.", "누적 10회. 입문자 혜택은 이미 종료되었습니다.", "10회 돌파. 아직 멈출 수 있는 구간입니다. 마지막 안내입니다.", "열 번째 뽑기 축하드립니다. 케이크는 상상으로 대체합니다."],
    "milestone-50": ["50번째 뽑기. 이제 취미란에 쓰셔도 됩니다.", "누적 50회. 손가락에 근육이 붙기 시작했습니다.", "50회 돌파. 카드팩이 당신 이름을 외웠습니다.", "반백 번 뽑으셨습니다. 결과는 묻지 않겠습니다.", "50회 달성. 가족들이 눈치채기 시작합니다.", "50번 뽑으셨습니다. 지금 그만두면 누구도 뭐라 안 합니다. 아마도."],
    "milestone-100": ["100번째 뽑기. 백 번의 기도입니다.", "누적 100회. 카드팩 VIP 라운지에 입장하셨습니다.", "100회 돌파. 손가락 안부를 확인해 주세요.", "백 번째. 숫자는 예쁘고 지갑은 마릅니다.", "100번 뽑으셨습니다. 이제 이 사이트의 장기 거주민입니다.", "100회 달성을 축하합니다. 걱정도 같이 드립니다."],
    "milestone-300": ["300회. 이 정도면 직업란에 쓰실 수 있습니다.", "누적 300번. 카드팩이 감사패를 준비 중입니다.", "300회. 스파르타도 이렇게는 안 뽑았습니다.", "300번째. 이제 손가락이 먼저 뽑습니다."],
    "night": ["지금은 새벽입니다. 카드도 주무시는 시간입니다.", "새벽에 뽑아도 확률은 그대롭니다. 수면 시간만 변합니다.", "내일의 당신이 오늘의 당신을 원망할 예정입니다.", "이 시간 깨어 계신 건 당신과 편의점뿐입니다.", "안내방송: 지금은 취침 시간입니다. 취침 시간입니다.", "새벽 뽑기 확인. 다크서클이 카드 한 장 분량입니다.", "해가 뜨기 전에 멈추는 것도 용기입니다.", "알림톡: 수면 부족 경고가 도착했습니다. 수신 거부 불가.", "새벽엔 손가락도 감성적이 됩니다. 한 번 더 누르게 됩니다.", "일기예보: 내일 오전, 졸음 100%."],
    "many-today": ["오늘 벌써 20번 넘게 뽑으셨습니다. 물 한 잔 드세요.", "오늘 뽑기 20회 초과. 손가락에 휴가를 주십시오.", "지갑이 조용히 사직서를 쓰고 있습니다.", "건강검진 결과: 오늘 뽑기 과다. 스트레칭을 권장합니다.", "내일의 당신은 잔고를 보며 놀랄 예정입니다.", "카드팩이 오늘은 이만 퇴근하고 싶어합니다.", "오늘 뽑기 20회 돌파. 근무 수당은 없습니다.", "안내방송: 이용 중인 고객님은 눈도 한 번 깜빡여 주십시오.", "오늘만 이만큼입니다. 내일이 걱정됩니다. 지갑 말고 손목이.", "20번 넘게 뽑으셨네요. 전설은 쉬어도 도망가지 않습니다."],
    "fb-SSS": ["[서버최초] SSS 획득. 서버가 제일 놀랐습니다.", "종결급 신화급 SSS티어. 근데 카드입니다.", "[월드 알림] 운빨 개체가 접속했습니다.", "마수각성 완료. 지갑은 각성 전입니다.", "천하무쌍 달성. 점심 메뉴는 아직 못 고름.", "[획득] 초레어 희귀 카드. 자랑은 여기서만 가능.", "현시점원탑 등극. 관중 0명, 환호 본인.", "[등급 판정] SSS티어. 판정관이 일어섰습니다.", "봉인이 풀렸다. 우주멸망 대신 SSS가 나왔다.", "우주멸망 직전입니다. 아, 카드였습니다.", "종결급입니다. 어차피 또 뽑으시겠지만.", "무한학살 모드 해방. 대상: 도감 빈칸.", "[패치 안내] SSS 확률 하향을 검토 중입니다.", "내 안의 초레어가 눈을 떴다. 카드팩은 눈을 감았다.", "천하무쌍의 검을 뽑았다. 카드였다.", "[경고] 행운 수치가 우주멸망 기준을 초과했습니다.", "확률 2%의 벽을 넘었습니다. 벽은 모릅니다.", "신화급 강림. 하늘색이 바뀐 건 모니터 탓입니다.", "현시점원탑. 시점은 방금 그 클릭입니다.", "[업적 달성] 클릭 한 번으로 신화가 되었습니다.", "상위티어 전원 기립. 박수 대신 새로고침.", "우주가 멸망해도 이 카드는 남습니다.", "풀강 SSS티어. 강화한 건 손가락뿐입니다.", "[등급 판정] 비교 대상이 없어 종료합니다.", "[서버 공지] 지금 캡처하시는 거 다 압니다.", "무한학살 시작. 첫 희생자는 당신의 평정심.", "마수각성! 마수는 카드팩 안에 있었습니다.", "초레어 희귀 종결급. 읽다가 숨 차셨죠?", "천하무쌍도 잠시 숨 고르는 중입니다.", "[시스템] 이 카드는 자랑 의무가 있습니다.", "종결급 신화급 풀강. 설명서가 도망쳤습니다.", "SSS티어의 재림. 서버실이 술렁입니다.", "역사적인 순간입니다. 본인만 아직 모릅니다.", "카드팩이 항복 선언문을 낭독 중입니다."],
    "sss-first": ["첫 SSS입니다. 입문하자마자 종결입니다.", "[서버최초] 이 사이트 첫 SSS 개통.", "초심자의 행운이라 쓰고 사기캐라 읽습니다.", "처음인데 SSS? 카드팩이 접대 중입니다.", "SSS 첫 경험. 눈높이가 너무 올라갔습니다.", "[업적 달성] 첫 SSS. 이제 내려갈 일만 남았습니다.", "첫 SSS 신고식 치고는 과합니다.", "SSS 도감 첫 칸 개방. 나머지는 가시밭길.", "초심자 보정 아닙니다. 순수 운빨입니다.", "마수각성 1단계. 시작부터 SSS티어.", "축하합니다. 이게 기본값은 아닙니다.", "튜토리얼에서 최종보스 드롭템을 먹었습니다."],
    "sss-after-drought": ["드디어 나왔습니다. 카드팩도 울고 있습니다.", "기다림 끝에 SSS. 존버는 배신하지 않았습니다.", "도시전설이 실존했습니다. 목격자는 당신입니다.", "주작 의심 접수. 하지만 진짜입니다.", "[서버 공지] 가뭄 종료. 비 대신 SSS가 내립니다.", "이게 나오네... 그동안 뭐였죠?", "SSS 짝사랑 종료. 이제 쌍방입니다.", "오래 걸렸습니다. 확률이 길을 잃었답니다.", "기도 응답 도착. 배송이 좀 늦었습니다.", "그동안의 꽝들은 오늘을 위한 복선이었습니다.", "카드팩이 이제야 미안했나 봅니다.", "가챠 난민, 약속의 땅에 도착했습니다.", "감격 지수 측정 불가. 측정기가 눈물로 고장.", "눈물 닦으세요. 카드가 번집니다.", "확률의 원수와 화해했습니다. 일시적으로."],
    "sss-streak": ["오늘 운 다 쓰셨습니다. 영수증은 없습니다.", "또 SSS? 확률이 퇴근을 못 했습니다.", "연속 SSS. 주작 검증팀이 출동합니다.", "이쯤 되면 카드팩이 당신 편입니다.", "[경고] 행운 잔고가 마이너스입니다.", "로또는 오늘 쓰셨으니 내일 사세요.", "SSS가 SSS를 불렀습니다.", "방금 그 SSS의 친구가 왔습니다.", "확률이 고장나서 수리 기사님이 오고 있습니다.", "우주멸망급 운빨입니다. 이제 그만 멈추세요.", "천하무쌍 연타. 다음 청구서가 두렵습니다.", "이 정도면 카드팩 안에 사람이 있습니다."],
    "sss-dup": ["이미 있는 SSS입니다. 이중 종결.", "중복 SSS. 보관함이 으스댑니다.", "같은 전설을 또 영접했습니다.", "[도감] 이미 등록된 신화입니다. 복제 아님.", "예비용 종결급이 확보되었습니다.", "낯이 익지만 SSS라 용서합니다.", "전설이 재방송 중입니다.", "한 장은 감상용, 한 장은 보관용. 이게 SSS의 길.", "중복 장인인데 등급이 SSS인 경우입니다.", "신화급이 쌍둥이로 태어났습니다."],
    "drought-sss-5": ["SSS 없이 5연속. 아직 초반입니다.", "SSS는 아직 당신을 만나줄 생각이 없습니다.", "SSS의 흔적을 찾지 못했습니다. 계속 찾으십시오.", "안내 말씀드립니다. 이번 카드도 SSS가 아닙니다.", "현재 SSS 가뭄 5회차입니다. 우산은 필요 없습니다.", "언젠간 나오겠죠. 아마도.", "SSS 접수창구는 현재 한산합니다.", "5회 연속 SSS 없음. 기록은 계속됩니다.", "SSS가 읽씹 중입니다.", "확률 2%는 5번쯤 외면할 수 있는 숫자입니다."],
    "drought-sss-10": ["열 번째 SSS 부재 안내. 기록 갱신 중입니다.", "SSS가 당신을 읽씹한 지 10회 차입니다.", "아직 괜찮습니다. 통계상 아직은요.", "SSS의 안부를 묻지 마십시오. 저희도 모릅니다.", "10회 연속 SSS 없음. 확률은 거짓말을 하지 않습니다.", "카드팩이 슬슬 눈을 피합니다.", "이번에도 아닙니다. 다음에도 아닐 수 있습니다.", "SSS는 현재 부재중입니다. 복귀 일자 미정.", "2%의 벽은 두껍습니다. 열 번쯤은 튕깁니다.", "SSS는 휴가 중이며 엽서도 없습니다."],
    "drought-sss-20": ["20회째 SSS 없음. 지갑이 조용히 울고 있습니다.", "SSS가 당신을 차단했습니다. 사유: 미상.", "카드팩이 당신을 동정하기 시작합니다.", "기도는 도착했으나 SSS가 수신을 거부했습니다.", "이쯤 되면 SSS는 소문입니다.", "스무 번 돌렸습니다. 얻은 것은 도감과 교훈.", "SSS는 없고 인내심 스탯이 올랐습니다.", "여기까지 했는데 안 나온다고요? 네.", "SSS 확률과 사이가 안 좋습니다. 조정 중입니다.", "가챠 난민 신청이 접수되었습니다."],
    "drought-sss-40": ["40회째. SSS는 전설 속에만 존재합니다.", "SSS는 있습니다. 다만 당신 쪽으로 오지 않습니다.", "평균 대기 50회. 거의 다 왔습니다. 평균상으로는요.", "목격담만 있고 증거는 없는 SSS.", "혹시 SSS를 본 적이 있나요? 저는 없습니다.", "눈물의 수집가 칭호가 슬슬 눈에 보입니다.", "40회 무SSS. 동정표는 확률을 바꾸지 못합니다.", "SSS보다 당신의 인내심이 희귀해졌습니다.", "카드팩의 눈빛이 미안함으로 가득합니다.", "멈추면 아깝고 계속하면 더 아깝습니다."],
    "drought-sss-70": ["70회. 이쯤 되면 SSS를 믿는 것도 신앙입니다.", "SSS는 마음속에 있습니다. 카드에는 없습니다.", "평균 대기 50회를 넘기셨습니다. 평균이 미안해합니다.", "SSS 도시전설 신봉자 모임에 오신 걸 환영합니다.", "매일 밤 SSS를 위해 기도하시죠?", "도감 빈칸이 당신을 바라보고 있습니다.", "이 정도면 확률이 개인적인 감정이 있습니다.", "SSS는 아직 오지 않았습니다. 오고는 있다고 합니다."],
    "drought-sss-100": ["100회 무SSS. 이제 SSS는 종교입니다.", "백 번째 외면. 확률의 의지가 대단합니다.", "여기까지 온 당신, 이미 전설입니다. 카드는 아니고요.", "도시전설 속 SSS의 마지막 목격자가 되셨습니다.", "우주멸망보다 SSS 한 장이 더 어렵습니다.", "SSS를 뽑는 것보다 SSS가 되는 게 빠릅니다.", "그만 돌리라고 하려 했는데, 제가 졌습니다.", "확률의 원수 100회 달성. 시상식은 없습니다."]
  }
};
export const TITLES = [
  {"id": "first-pull", "name": "개통 완료", "flavor": "고객님의 뽑기가 정상 개통되었습니다.", "sub": "요금제는 지갑 사정에 따라 다릅니다", "desc": "처음으로 카드를 뽑는다", "hint": "???", "tier": "common", "secret": true, "cond": {"type": "draws", "n": 1}},
  {"id": "c-streak-3", "name": "C와 친해지다", "flavor": "C가 이제 전화번호를 안다", "sub": "C등급이 3번 연속 나왔다", "desc": "C등급 카드를 3번 연속으로 뽑는다", "hint": "???", "tier": "common", "secret": true, "cond": {"type": "gradeStreak", "grades": ["C"], "n": 3}},
  {"id": "dup-5", "name": "빈손은 아니다", "flavor": "새로운 건 없지만 칭호는 있습니다.", "sub": "중복 카드가 다섯 번 쌓였다", "desc": "이미 가진 카드를 누적 5번 다시 뽑는다", "hint": "???", "tier": "common", "secret": true, "cond": {"type": "dupTotal", "n": 5}},
  {"id": "repeat-master", "name": "중복의 달인", "flavor": "또 너냐?", "sub": "직전과 똑같은 카드가 나왔다", "desc": "직전에 뽑은 카드와 같은 카드를 또 뽑는다", "hint": "???", "tier": "common", "secret": true, "cond": {"type": "repeat", "n": 1}},
  {"id": "first-sss", "name": "서버최초 당첨자", "flavor": "[서버최초] 초레어 희귀 SSS티어 획득!", "sub": "도감에 전용 등급을 신설합니다", "desc": "SSS등급 카드를 처음 뽑는다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "gradeDraw", "grades": ["SSS"], "n": 1}},
  {"id": "sss-drought-60", "name": "SSS 짝사랑꾼", "flavor": "짝사랑은 원래 일방통행입니다.", "sub": "SSS 없이 60번째 뽑기", "desc": "SSS 없이 60번 연속으로 뽑는다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "drought", "grade": "SSS", "n": 60}},
  {"id": "same-card-5", "name": "운명의 장난", "flavor": "이 정도면 운명입니다.", "sub": "같은 카드가 5장이 됐다", "desc": "한 가지 카드를 5장 이상 보유한다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "sameCardCount", "n": 5}},
  {"id": "c-streak-5", "name": "C의 간택", "flavor": "C가 당신을 선택했습니다.", "sub": "C등급이 5번 연속 나왔다", "desc": "C등급 카드를 5번 연속으로 뽑는다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "gradeStreak", "grades": ["C"], "n": 5}},
  {"id": "sss-drought-100", "name": "존버의 화신", "flavor": "존버는 승리한다. 승리는 아직입니다.", "sub": "SSS 없이 100번째 뽑기", "desc": "SSS 없이 100번 연속으로 뽑는다", "hint": "???", "tier": "epic", "secret": true, "cond": {"type": "drought", "grade": "SSS", "n": 100}},
  {"id": "complete-c", "name": "이게 취미였구나", "flavor": "허접한 주민 30명 전원 출석입니다.", "sub": "C등급 30장 전부 수집", "desc": "C등급 카드 30장을 전부 모은다", "hint": "???", "tier": "epic", "secret": true, "cond": {"type": "gradeComplete", "grade": "C"}},
  {"id": "c-vip", "name": "C VIP", "flavor": "C등급 정기구독 감사합니다.", "sub": "누적 C가 150장째", "desc": "C등급 카드를 누적 150번 뽑는다", "hint": "???", "tier": "epic", "secret": true, "cond": {"type": "gradeDraw", "grades": ["C"], "n": 150}},
  {"id": "complete-ss", "name": "인생을 갈아 넣다", "flavor": "여기까지 온 당신, 잠은 자고 있나요?", "sub": "SS등급 8장 전부 수집", "desc": "SS등급 카드 8장을 전부 모은다", "hint": "???", "tier": "legend", "secret": true, "cond": {"type": "gradeComplete", "grade": "SS"}},
  {"id": "double-sss", "name": "확률 404 Not Found", "flavor": "[월드 알림] 확률 담당자가 퇴근했습니다.", "sub": "SSS가 연속으로 나왔다", "desc": "SSS등급 카드를 2번 연속으로 뽑는다", "hint": "???", "tier": "legend", "secret": true, "cond": {"type": "gradeStreak", "grades": ["SSS"], "n": 2}},
  {"id": "all-complete", "name": "신화급 노가다", "flavor": "[서버최초] 91장 전부 수집. 이제 뭐 하죠?", "sub": "종결급 노가다에 성공했습니다", "desc": "카드 91장을 전부 모은다", "hint": "???", "tier": "legend", "secret": true, "cond": {"type": "allComplete"}},
  {"id": "a-first-b", "name": "C 졸업", "flavor": "졸업장 대신 B 한 장 받았습니다.", "sub": "처음으로 B가 나왔다", "desc": "B등급 카드를 처음 뽑는다", "hint": "???", "tier": "common", "secret": true, "cond": {"type": "gradeDraw", "grades": ["B"], "n": 1}},
  {"id": "a-first-a", "name": "A급 인재", "flavor": "이력서에 한 줄 쓸 수 있습니다. 쓰진 마세요.", "sub": "처음으로 A가 나왔다", "desc": "A등급 카드를 처음 뽑는다", "hint": "???", "tier": "common", "secret": true, "cond": {"type": "gradeDraw", "grades": ["A"], "n": 1}},
  {"id": "a-first-s", "name": "S 영접 완료", "flavor": "오늘은 기분 좋아도 된다는 공식 허가입니다.", "sub": "처음으로 S가 나왔다", "desc": "S등급 카드를 처음 뽑는다", "hint": "???", "tier": "common", "secret": true, "cond": {"type": "gradeDraw", "grades": ["S"], "n": 1}},
  {"id": "a-draws-10", "name": "열 번째 클릭", "flavor": "손가락이 이 사이트를 기억하기 시작했습니다.", "sub": "누적 10번째 뽑기", "desc": "누적 10번 뽑는다", "hint": "???", "tier": "common", "secret": true, "cond": {"type": "draws", "n": 10}},
  {"id": "a-draws-20", "name": "단골 등록", "flavor": "카드팩이 이름은 몰라도 얼굴은 압니다.", "sub": "누적 20번째 뽑기", "desc": "누적 20번 뽑는다", "hint": "???", "tier": "common", "secret": true, "cond": {"type": "draws", "n": 20}},
  {"id": "a-b-streak-2", "name": "B 쌍둥이", "flavor": "평범함이 두 번 연속 도착했습니다.", "sub": "B등급이 2번 연속 나왔다", "desc": "B등급 카드를 2번 연속으로 뽑는다", "hint": "???", "tier": "common", "secret": true, "cond": {"type": "gradeStreak", "grades": ["B"], "n": 2}},
  {"id": "a-c-dozen", "name": "C 한 타스", "flavor": "C 열두 장, 도매가로 모셨습니다.", "sub": "누적 C가 12장째", "desc": "C등급 카드를 누적 12번 뽑는다", "hint": "???", "tier": "common", "secret": true, "cond": {"type": "gradeDraw", "grades": ["C"], "n": 12}},
  {"id": "a-new-streak-8", "name": "대규모 채용", "flavor": "도감 인사팀이 야근을 시작했습니다.", "sub": "처음 보는 카드가 8번 연속", "desc": "처음 보는 카드를 8번 연속으로 뽑는다", "hint": "???", "tier": "common", "secret": true, "cond": {"type": "newStreak", "n": 8}},
  {"id": "a-day-15", "name": "손가락 야근", "flavor": "오늘 근무 수당은 칭호로 대체됩니다.", "sub": "하루에 15번 뽑았다", "desc": "하루에 15번 이상 뽑는다", "hint": "???", "tier": "common", "secret": true, "cond": {"type": "dayDraws", "n": 15}},
  {"id": "a-draws-50", "name": "손목 보험 가입", "flavor": "50번째 뽑기. 보험 심사가 시작됩니다.", "sub": "누적 50번째 뽑기", "desc": "누적 50번 뽑는다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "draws", "n": 50}},
  {"id": "a-draws-100", "name": "장기 거주민", "flavor": "이 사이트에 전입신고를 하셨습니다.", "sub": "누적 100번째 뽑기", "desc": "누적 100번 뽑는다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "draws", "n": 100}},
  {"id": "a-first-ss", "name": "상층부 입성", "flavor": "엘리베이터가 딱 한 층 남았습니다.", "sub": "처음으로 SS가 나왔다", "desc": "SS등급 카드를 처음 뽑는다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "gradeDraw", "grades": ["SS"], "n": 1}},
  {"id": "a-collect-30", "name": "도감 3할 타자", "flavor": "3할이면 강타자인데 도감에선 아직 2군입니다.", "sub": "도감을 30% 채웠다", "desc": "도감의 30%를 채운다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "collectionPercent", "pct": 30}},
  {"id": "a-collect-50", "name": "반타작 성공", "flavor": "반은 채웠습니다. 나머지 반이 문제입니다.", "sub": "도감을 50% 채웠다", "desc": "도감의 50%를 채운다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "collectionPercent", "pct": 50}},
  {"id": "a-same-3", "name": "삼형제 상봉", "flavor": "같은 카드 셋이 모여 가족사진을 찍습니다.", "sub": "같은 카드가 3장이 됐다", "desc": "한 가지 카드를 3장 이상 보유한다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "sameCardCount", "n": 3}},
  {"id": "a-dup-streak-4", "name": "아는 얼굴 4연타", "flavor": "새 얼굴은 지금 길을 찾는 중입니다.", "sub": "중복 카드가 4번 연속", "desc": "이미 가진 카드를 4번 연속으로 뽑는다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "dupStreak", "n": 4}},
  {"id": "a-top-absent-10", "name": "상위권 부재중", "flavor": "A 이상 창구가 열 번째 문을 닫았습니다.", "sub": "A 이상 없이 10번 연속", "desc": "A등급 이상이 나오지 않은 채 10번 연속으로 뽑는다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "drought", "grade": "A", "n": 10}},
  {"id": "a-owl", "name": "올빼미 당첨", "flavor": "다크서클이 칭호 한 장 분량 늘었습니다.", "sub": "새벽에 뽑았다", "desc": "새벽 0시부터 5시 사이에 뽑는다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "all", "conds": [{"type": "hour", "from": 0, "to": 5}, {"type": "draws", "n": 6}]}},
  {"id": "a-lunch", "name": "점심 거르는 중", "flavor": "카드 한 장에 밥 한 숟갈이 사라집니다.", "sub": "점심시간에 뽑았다", "desc": "낮 12시부터 오후 2시 사이에 뽑는다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "all", "conds": [{"type": "hour", "from": 12, "to": 14}, {"type": "draws", "n": 6}]}},
  {"id": "b-day-30", "name": "연장근로 확정", "flavor": "오늘 근무 시간 초과. 수당은 카드팩이 안 줍니다.", "sub": "하루에 30번째 뽑기", "desc": "하루에 카드를 30번 뽑는다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "dayDraws", "n": 30}},
  {"id": "b-a-plus-4", "name": "C가 휴가 간 날", "flavor": "C와 B가 단체로 연차를 냈습니다.", "sub": "A 이상이 4번 연속 나왔다", "desc": "A등급 이상 카드를 4번 연속으로 뽑는다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "gradeStreak", "grades": ["A", "S", "SS", "SSS"], "n": 4}},
  {"id": "b-sss-3", "name": "SSS 단골 손님", "flavor": "[월드 알림] 단골 손님이 접속했습니다.", "sub": "SSS가 세 번째", "desc": "SSS등급 카드를 누적 3번 뽑는다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "gradeDraw", "grades": ["SSS"], "n": 3}},
  {"id": "b-collect-75", "name": "남은 건 어려운 놈들", "flavor": "쉬운 칸은 다 채웠습니다. 이제부터 지옥입니다.", "sub": "도감 75% 달성", "desc": "카드 도감을 75% 이상 채운다", "hint": "???", "tier": "rare", "secret": true, "cond": {"type": "collectionPercent", "pct": 75}},
  {"id": "b-night-ss", "name": "잠 대신 SS", "flavor": "수면 시간을 SS로 환전했습니다.", "sub": "새벽 3~5시의 SS", "desc": "새벽 3시~5시 사이에 SS등급 이상 카드를 뽑는다", "hint": "???", "tier": "epic", "secret": true, "cond": {"type": "all", "conds": [{"type": "hour", "from": 3, "to": 5}, {"type": "gradeAtLeast", "grade": "SS"}]}},
  {"id": "b-complete-b", "name": "무난함의 완성", "flavor": "평범한 주민 20명, 단체 사진 찍었습니다.", "sub": "B등급 20장 전부 수집", "desc": "B등급 카드 20장을 전부 모은다", "hint": "???", "tier": "epic", "secret": true, "cond": {"type": "gradeComplete", "grade": "B"}},
  {"id": "b-complete-a", "name": "올 A 학점", "flavor": "A 15종 올 클리어. 장학금은 없습니다.", "sub": "A등급 15장 전부 수집", "desc": "A등급 카드 15장을 전부 모은다", "hint": "???", "tier": "epic", "secret": true, "cond": {"type": "gradeComplete", "grade": "A"}},
  {"id": "b-same-10", "name": "한 지붕 열 식구", "flavor": "같은 카드 10장. 이쯤 되면 가족입니다.", "sub": "같은 카드가 10장이 됐다", "desc": "한 가지 카드를 10장 이상 보유한다", "hint": "???", "tier": "epic", "secret": true, "cond": {"type": "sameCardCount", "n": 10}},
  {"id": "b-sss-10", "name": "종결급 큰손", "flavor": "[월드 알림] SSS 열 장째 주문 접수. VIP 응대 개시.", "sub": "SSS 누적 10장째", "desc": "SSS등급 카드를 누적 10번 뽑는다", "hint": "???", "tier": "epic", "secret": true, "cond": {"type": "gradeDraw", "grades": ["SSS"], "n": 10}},
  {"id": "b-sss-after-drought", "name": "기다림의 보상", "flavor": "[서버 공지] 가뭄 종료. 밀린 SSS가 일시불 지급됩니다.", "sub": "SSS 없이 100번 뒤에 SSS", "desc": "SSS 없이 100번 넘게 뽑은 뒤 SSS등급 카드를 뽑는다", "hint": "???", "tier": "epic", "secret": true, "cond": {"type": "droughtBeforeThis", "grade": "SSS", "n": 100}},
  {"id": "b-sss-complete", "name": "여섯 명 풀파티", "flavor": "[월드 알림] 종결급 6인 집결. 서버가 잠깐 멈췄습니다.", "sub": "SSS 6장 전부 수집", "desc": "SSS등급 카드 6장을 전부 모은다", "hint": "???", "tier": "legend", "secret": true, "cond": {"type": "gradeComplete", "grade": "SSS"}},
  {"id": "b-ss-plus-3", "name": "확률이 취했다", "flavor": "[월드 알림] 확률 담당자가 회식 중입니다.", "sub": "SS 이상이 3번 연속 나왔다", "desc": "SS등급 이상 카드를 3번 연속으로 뽑는다", "hint": "???", "tier": "legend", "secret": true, "cond": {"type": "gradeStreak", "grades": ["SS", "SSS"], "n": 3}},
  {"id": "b-same-20", "name": "카드와 혼인신고", "flavor": "같은 카드 20장. 이 정도면 법적 부부입니다.", "sub": "같은 카드가 20장이 됐다", "desc": "한 가지 카드를 20장 이상 보유한다", "hint": "???", "tier": "legend", "secret": true, "cond": {"type": "sameCardCount", "n": 20}},
  {"id": "b-c-streak-8", "name": "C가 눌러앉다", "flavor": "C 8연속. 퇴실 시간을 한참 넘겼습니다.", "sub": "C등급이 8번 연속 나왔다", "desc": "C등급 카드를 8번 연속으로 뽑는다", "hint": "???", "tier": "legend", "secret": true, "cond": {"type": "gradeStreak", "grades": ["C"], "n": 8}},
  {"id": "b-day-100", "name": "손목 순직 직전", "flavor": "[월드 알림] 손목이 사직서를 제출했습니다.", "sub": "하루에 100번째 뽑기", "desc": "하루에 카드를 100번 뽑는다", "hint": "???", "tier": "legend", "secret": true, "cond": {"type": "dayDraws", "n": 100}}
];
// </titles-data>

const TITLE_GRADES = ['C', 'B', 'A', 'S', 'SS', 'SSS'];
const TITLE_RECENT_MAX = 120;
const titleRank = (grade) => TITLE_GRADES.indexOf(grade);
const titleInt = (value) => Number.isSafeInteger(value) && value >= 0 && value < 100000000 ? value : 0;
// 현재 연속 길이: recent(최근 뽑은 등급들, 오래된 것부터)의 끝에서부터 test 를 만족하는 개수
const titleRun = (recent, test) => { let n = 0; for (let i = recent.length - 1; i >= 0 && test(recent[i]); i--) n++; return n; };
const titleGradeCards = (ctx, grade) => ctx.pack.cards.map((card, index) => [card, index]).filter(([card]) => (card.grade || 'SSS') === grade);

// 판정 컨텍스트 x = {stats(이번 뽑기까지 반영), card, grade, index, isNew, pack, counts(이번 카드까지 반영), hour}
const TITLE_CONDS = {
  draws: (c, x) => x.stats.draws >= c.n,
  repeat: (c, x) => x.stats.repeatStreak >= c.n,
  sameCardCount: (c, x) => x.counts[x.index] >= c.n,
  dupTotal: (c, x) => x.stats.dupTotal >= c.n,
  dupStreak: (c, x) => x.stats.dupStreak >= c.n,
  newStreak: (c, x) => x.stats.newStreak >= c.n,
  gradeStreak: (c, x) => titleRun(x.stats.recent, (g) => c.grades.includes(g)) >= c.n,
  gradeDraw: (c, x) => c.grades.reduce((sum, g) => sum + (x.stats.drawn[g] || 0), 0) >= c.n,
  gradeAtLeast: (c, x) => titleRank(x.grade) >= titleRank(c.grade),
  drought: (c, x) => titleRun(x.stats.recent, (g) => titleRank(g) < titleRank(c.grade)) >= c.n,
  gradeComplete: (c, x) => { const cards = titleGradeCards(x, c.grade); return cards.length > 0 && cards.every(([, index]) => x.counts[index] > 0); },
  allComplete: (c, x) => x.counts.length > 0 && x.counts.every((count) => count > 0),
  collectionPercent: (c, x) => x.counts.length > 0 && x.counts.filter((count) => count > 0).length * 100 >= c.pct * x.counts.length,
  hour: (c, x) => c.from <= c.to ? x.hour >= c.from && x.hour < c.to : x.hour >= c.from || x.hour < c.to,
  dayDraws: (c, x) => x.stats.dayDraws >= c.n,
  thisGrade: (c, x) => c.grades.includes(x.grade),
  isNew: (c, x) => x.isNew === true,
  isDup: (c, x) => x.isNew === false,
  firstDraw: (c, x) => x.stats.draws === 1,
  // 이번 카드가 해당 등급 이상이고, 직전까지(이번 뽑기 제외) 그 등급 미만이 n번 이상 연속이었다(가뭄 끝).
  droughtBeforeThis: (c, x) => titleRank(x.grade) >= titleRank(c.grade) && titleRun(x.stats.recent.slice(0, -1), (g) => titleRank(g) < titleRank(c.grade)) >= c.n,
  all: (c, x) => c.conds.every((sub) => titleCondMet(sub, x)),
  // 안의 cond 가 거짓일 때만 참(안의 cond 가 없거나 잘못되면 거짓: 오류가 참으로 뒤집히지 않게).
  not: (c, x) => c.cond != null && TITLE_CONDS[c.cond.type] !== undefined && !titleCondMet(c.cond, x)
};
function titleCondMet(cond, ctx) { const check = TITLE_CONDS[cond?.type]; return check ? check(cond, ctx) === true : false; }
// 잘못된 칭호 정의가 뽑기를 깨뜨리지 않도록 항상 감싼다.
export function titleMet(title, ctx) { try { return titleCondMet(title.cond, ctx); } catch { return false; } }

export function emptyTitleStats() { return {draws: 0, ticketDraws: 0, lastCardKey: '', repeatStreak: 0, dupStreak: 0, dupTotal: 0, newStreak: 0, recent: [], drawn: {}, dayKey: '', dayDraws: 0}; }
// 저장된 통계를 검증해 안전한 값으로 되돌린다(타입·범위가 틀리면 0/빈 값).
export function cleanTitleStats(raw) {
  const stats = emptyTitleStats();
  if (!raw || typeof raw !== 'object') return stats;
  for (const name of ['draws', 'ticketDraws', 'repeatStreak', 'dupStreak', 'dupTotal', 'newStreak', 'dayDraws']) stats[name] = titleInt(raw[name]);
  if (typeof raw.lastCardKey === 'string' && raw.lastCardKey.length <= 80) stats.lastCardKey = raw.lastCardKey;
  if (typeof raw.dayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dayKey)) stats.dayKey = raw.dayKey;
  if (Array.isArray(raw.recent)) stats.recent = raw.recent.filter((g) => TITLE_GRADES.includes(g)).slice(-TITLE_RECENT_MAX);
  if (raw.drawn && typeof raw.drawn === 'object') for (const grade of TITLE_GRADES) stats.drawn[grade] = titleInt(raw.drawn[grade]);
  return stats;
}
// 뽑기 한 번을 통계에 반영(순수 함수): d = {key: `${packId}:${cardId}`, grade, isNew, dayKey}
export function nextTitleStats(s, d) {
  return {
    draws: s.draws + 1, ticketDraws: (s.ticketDraws || 0) + (d.ticket ? 1 : 0), lastCardKey: d.key, repeatStreak: s.lastCardKey === d.key ? s.repeatStreak + 1 : 0,
    dupStreak: d.isNew ? 0 : s.dupStreak + 1, dupTotal: s.dupTotal + (d.isNew ? 0 : 1), newStreak: d.isNew ? s.newStreak + 1 : 0,
    recent: [...s.recent, d.grade].slice(-TITLE_RECENT_MAX), drawn: {...s.drawn, [d.grade]: (s.drawn[d.grade] || 0) + 1},
    dayKey: d.dayKey, dayDraws: s.dayKey === d.dayKey ? s.dayDraws + 1 : 1
  };
}

// 한마디 한 줄 고르기: 우선순위가 가장 높은(같으면 합친) 규칙의 풀 → 없으면 등급별 폴백 풀. recent(최근에 보여 준 줄)는 피하고, 모두 소진되면 직전 줄만이라도 피한다. 줄이 없으면 ''.
const quipList = (list) => Array.isArray(list) ? list.filter((line) => typeof line === 'string' && line) : [];
const quipLines = (quips, rule) => quipList(rule?.pool != null ? quips?.pools?.[rule.pool] : rule?.lines);
export function pickQuip(ctx, quips, recent = [], random = Math.random) {
  let top = -Infinity, lines = [];
  for (const rule of quips?.rules || []) {
    const own = quipLines(quips, rule);
    if (!own.length || !(rule.when == null || titleMet({cond: rule.when}, ctx))) continue;
    if (rule.p != null && !(random() < Number(rule.p))) continue; // 맞는 규칙도 확률 p 로만 적용(아니면 다음 우선순위 / 폴백). p 가 이상한 값이면 적용 안 함
    const pri = Number(rule.pri) || 0;
    if (pri > top) { top = pri; lines = own; } else if (pri === top) lines = lines.concat(own);
  }
  if (!lines.length) lines = quipLines(quips, {pool: quips?.fallbackPools?.[ctx.grade]});
  if (!lines.length) return '';
  const fresh = lines.filter((line) => !recent.includes(line)), other = lines.filter((line) => line !== recent[recent.length - 1]);
  const pool = fresh.length ? fresh : other.length ? other : lines;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
