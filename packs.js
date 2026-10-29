// Add a pack here to create its bundle, wrapper, draw pool and collection tab.
// Give every pack its own stable storageKey; keep card order stable after release.
export const PACK_SETS = [
  {
    id: 'secret-01',
    label: '시크릿 팩',
    brand: 'CHIIKAWA',
    edition: 'SECRET PACK',
    boxImage: 'assets/secret-box.png',
    wrapperImage: 'assets/secret-pack.png',
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
