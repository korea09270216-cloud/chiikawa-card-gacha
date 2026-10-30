// Add a pack here to create its bundle, wrapper, draw pool and collection tab.
// Give every pack its own stable storageKey; keep card order stable after release.
export const PACK_SETS = [
  {
    id: 'secret-01',
    label: '시크릿 팩',
    brand: 'CHIIKAWA',
    edition: 'SECRET PACK',
    boxImage: 'assets/secret-box.webp',
    wrapperImage: 'assets/secret-pack.webp',
    storageKey: 'chiikawa-awakening-v1',
    cards: [
      {id:1,name:'치이카와',image:'assets/cards/card-01.png'},
      {id:2,name:'하치와레',image:'assets/cards/card-02.png'},
      {id:3,name:'우사기',image:'assets/cards/card-03.png'},
      {id:4,name:'모몽가',image:'assets/cards/card-04.png'},
      {id:5,name:'랏코',image:'assets/cards/card-05.png'},
      {id:6,name:'쿠리만쥬',image:'assets/cards/card-06.png'}
    ]
  }
];

// 출시 예정 자리표시(카드팩 목록의 COMING SOON). 저장·뽑기·컬렉션은 PACK_SETS 만 사용하므로 여기 항목은 선택/뽑기 불가.
// 새 팩 출시 시: 위 PACK_SETS 에 팩을 추가하고, 아래 UPCOMING_PACKS 에서 한 자리를 제거한다.
export const UPCOMING_PACKS = [
  {id: 'soon-01', label: '준비 중'},
  {id: 'soon-02', label: '준비 중'},
  {id: 'soon-03', label: '준비 중'}
];
