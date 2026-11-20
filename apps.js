// 접속 페이지에서 열 수 있는 페이지 목록. 로그인 화면(index.html)과 서비스 워커(sw.js)가 함께 읽는다.
//   prefix  이 사이트에서 열리는 경로
//   root    비공개 저장소 안에서 그 경로에 대응하는 폴더 ('' = 저장소 맨 위)
// 페이지를 추가하려면 여기에 한 줄을 넣고, 그 저장소를 읽을 수 있는 토큰을 접속 페이지에 입력하면 된다.
self.NM_APPS = [
  {
    id: 'niagara', title: '나이아가라 모바일', desc: '언리얼 나이아가라 이미터와 이펙트를 만들고 .uasset으로 내보내는 편집기',
    owner: 'kdw471', repo: 'niagara-mobile', branch: 'main', prefix: '/niagara/', root: 'niagara/',
  },
  {
    id: 'mindmap', title: 'MindFlow 마인드맵', desc: '모바일 마인드맵 편집기',
    owner: 'kdw471', repo: 'mindmap-mobile', branch: 'main', prefix: '/mindmap/', root: '',
  },
];
