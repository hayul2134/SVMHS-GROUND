// SVMHS GROUND — 엔딩 크레딧(2026-11-05 하율 "직업 넣으면 AI 대체 시점이 나오는 서비스, SVMHS 서비스에 넣고 싶어", 미리보기 깃발 ending-credit — 개발자만)
// 직업을 넣으면 AI가 그 일을 대신하기까지 남은 시간(재미용 추정)을 보여 줌. 서버·DB 없음 — 계산은 전부 이 파일.
// 점수: 직업마다 6가지(반복·화면 안 작업 / 창의·현장·사람·책임) 1~5점 → 노출도 E → 남은 해(약 4개월~30년+).
// 목록에 없는 직업은 6문항으로 같은 공식. 결과 카드는 캔버스 PNG(길게 눌러 저장·다운로드). CSP 때문에 style="" 대신 el.style만 씀.
import { esc, toast, store } from './util.js';

// 이름|분야(연·촬·후·디·출·마 = 영상고 진로, g = 유명 직업)|다른 이름|반복 화면 창의 현장 사람 책임
const RAW = `영상 편집자|후|편집자,영상편집,편집,영상 편집,컷편집|4 5 3 1 2 1
종합편집 기사|후|종편,온라인 편집,종합편집|4 5 2 2 3 2
포스트 프로덕션 슈퍼바이저|후|후반작업 감독,포스트 프로덕션,후반 감독,후반작업|2 4 4 2 5 3
컬러리스트|후|색보정,컬러그레이딩,컬러 그레이딩|4 5 4 1 3 2
VFX 아티스트|후|vfx,cg,특수효과,cg 아티스트,합성|4 5 4 1 2 2
사운드 디자이너|후|사운드,음향,효과음,음향감독,믹싱|3 5 4 1 2 2
폴리 아티스트|후|폴리,효과음 녹음|3 3 4 4 2 1
작곡가|후|작곡,bgm,음악 프로듀서|3 5 5 1 2 1
자막 번역가|후|영상번역,자막,영상 번역|5 5 2 1 1 1
DIT|후|데이터 매니저,dit|4 4 2 4 2 2
유튜브 PD|연|유튜브pd,유튜브 피디,유튜브 연출|3 4 4 2 3 2
방송 PD|연|pd,피디,방송피디,예능pd,예능 피디,드라마pd|2 3 5 3 4 3
조연출|연|ad,연출부,조연출|3 3 3 4 4 2
영화감독|연|감독,연출,영화 감독|1 2 5 3 5 4
다큐멘터리 감독|연|다큐감독,다큐|2 3 5 4 5 3
뮤직비디오 감독|연|뮤비감독,mv감독,뮤비 감독|2 3 5 3 4 2
광고 감독|연|cf감독,광고연출,cf 감독|2 3 5 3 5 3
영화 프로듀서|연|영화 pd,제작자,프로듀서|2 3 4 3 5 4
시나리오 작가|연|각본가,시나리오,드라마 작가|2 5 5 1 2 2
방송작가|연|구성작가,예능작가|3 5 4 2 3 2
콘텐츠 기획자|연|기획자,콘텐츠기획|3 5 4 1 3 2
캐스팅 디렉터|연|캐스팅|2 3 3 3 5 2
연예인 매니저|연|매니저,로드매니저|2 2 3 4 5 2
기자|연|언론인,뉴스,방송기자|3 4 4 3 4 4
촬영감독|촬|촬영,카메라감독,dop,촬영 감독|2 2 4 5 3 3
촬영기사|촬|카메라맨,촬영보조,카메라 기사,짐벌|3 2 2 5 2 2
드론 촬영 기사|촬|드론,항공촬영|3 2 3 5 2 4
영상 기자|촬|카메라 기자|3 3 3 5 4 3
조명감독|촬|조명,조명기사|2 1 4 5 3 3
녹음기사|촬|녹음,동시녹음,레코딩 엔지니어|3 4 3 3 3 2
중계 기술감독|촬|중계,기술감독,스위처,td|3 3 3 4 4 3
방송 엔지니어|촬|송출,방송기술,엔지니어|4 3 2 4 2 3
무대감독|촬|공연감독,무대,무대 연출|2 2 4 5 4 4
미술감독|촬|아트디렉터,세트디자이너,프로덕션디자이너|2 3 5 4 4 3
메이크업 아티스트|촬|분장사,메이크업,분장|2 1 4 5 4 1
스타일리스트|촬|코디,코디네이터|2 2 4 5 4 1
사진작가|촬|포토그래퍼,사진사|3 3 4 4 4 2
시각디자이너|디|시디,그래픽디자이너,그래픽 디자이너,디자이너|4 5 4 1 2 1
썸네일 디자이너|디|썸네일|4 5 3 1 2 1
모션그래픽 디자이너|디|모션그래픽,모그,애펙,애프터이펙트|4 5 4 1 2 1
방송 CG 디자이너|디|방송 cg,자막 디자이너,cg 디자이너|4 5 3 1 2 1
3D 모델러|디|3d,모델러,3d디자이너,3d 디자이너|4 5 3 1 1 1
애니메이터|디|애니메이션,2d애니메이터|4 5 4 1 2 1
스토리보드 아티스트|디|콘티 작가,콘티,스토리보드|3 5 4 1 3 1
캐릭터 디자이너|디|캐릭터|3 5 5 1 2 1
일러스트레이터|디|일러스트,그림작가|4 5 4 1 2 1
웹툰 작가|디|웹툰,만화가|3 5 5 1 2 1
편집 디자이너|디|편디,출판 디자이너,잡지 디자이너|4 5 3 1 2 1
UX 디자이너|디|ui디자이너,uiux,웹디자이너,ui 디자이너,웹 디자이너|4 5 4 1 3 1
미디어 아티스트|디|미디어아트,vj,영상 설치|2 4 5 3 3 1
AI 영상 크리에이터|디|ai 영상,생성형 ai,ai영상|3 5 4 1 2 1
유튜버|출|크리에이터,인플루언서|2 4 5 2 5 1
숏폼 크리에이터|출|쇼츠,릴스,틱톡커,숏폼|3 4 4 2 4 1
스트리머|출|인터넷방송,bj,방송인|1 4 4 2 5 1
버추얼 유튜버|출|버튜버,버츄얼|3 5 4 1 4 1
배우|출|연기자,연기|1 2 4 5 5 2
가수|출|아이돌,연예인|1 2 4 5 5 1
모델|출|패션모델|3 3 3 4 3 1
성우|출|더빙,내레이터|4 4 3 2 3 1
아나운서|출|앵커,mc,진행자|3 3 3 3 5 3
쇼호스트|출|라이브커머스,홈쇼핑|3 3 3 3 5 2
SNS 마케터|마|sns,소셜미디어,인스타 마케터,sns 마케터|4 5 3 1 3 1
광고 기획자|마|ae,광고기획|3 4 4 2 5 2
카피라이터|마|카피|4 5 4 1 2 1
영화 마케터|마|영화홍보,배급 마케터|3 4 4 2 4 1
마케터|마|마케팅|4 5 4 1 3 1
의사|g|외과의사,내과의사|2 3 4 5 5 5
간호사|g|간호|2 2 3 5 5 5
약사|g|약국|4 3 2 3 4 5
수의사|g|동물병원|2 2 4 5 4 5
변호사|g|법조인|3 5 4 1 5 5
판사|g|법관|3 4 4 1 4 5
회계사|g|공인회계사|4 5 3 1 3 5
교사|g|선생님,중학교 교사,고등학교 교사,초등학교 교사,전공 교사,영상 교사,담임|2 3 4 4 5 4
경찰관|g|경찰|2 2 3 5 5 5
소방관|g|소방|1 1 3 5 5 5
군인|g|직업군인,부사관|2 1 3 5 4 4
공무원|g|행정직 공무원,9급 공무원|4 4 2 2 3 4
회사원|g|사무직,사무원,직장인|5 5 2 1 2 1
은행원|g|은행|5 5 2 2 3 3
프로그래머|g|개발자,웹개발자,소프트웨어 엔지니어,코딩|4 5 4 1 2 2
게임 개발자|g|게임프로그래머,게임 프로그래머,게임 기획자|3 5 4 1 2 2
데이터 분석가|g|데이터 사이언티스트,분석가|4 5 4 1 2 2
프로게이머|g|게이머|1 3 3 5 3 1
운동선수|g|선수|1 1 3 5 4 1
요리사|g|셰프,조리사|3 1 4 5 3 3
바리스타|g|카페|4 1 2 5 4 1
미용사|g|헤어디자이너,헤어|2 1 4 5 5 2
헬스 트레이너|g|트레이너,pt|2 1 3 5 5 2
파일럿|g|조종사,기장|3 3 3 4 3 5
승무원|g|스튜어디스,항공승무원|3 1 2 5 5 4
건축가|g|건축사|3 4 5 3 4 5
심리상담사|g|상담사,심리치료사|2 3 4 2 5 4
번역가|g|번역|5 5 3 1 1 1
콜센터 상담원|g|상담원,텔레마케터,cs|5 5 1 1 3 1
공인중개사|g|부동산 중개사,부동산|4 4 2 3 4 3
소설가|g|작가,문학작가|2 5 5 1 1 1
배달기사|g|배달,라이더|4 2 1 4 2 1
택시기사|g|택시|4 2 1 4 3 3
편의점 직원|g|편의점 알바,판매원,편의점|5 2 1 3 3 1
공장 생산직|g|생산직,공장|5 2 1 4 1 2`;
// [AI가 먼저 가져갈 일, 끝까지 사람이 하는 일, 엔딩을 미루는 한 수]
const NOTE = {
'영상 편집자':['컷 편집, 자막 넣기, 싱크 맞추기 같은 손 작업','어디서 웃기고 어디서 멈춰야 하는지 아는 리듬감과 연출','AI 편집 툴을 먼저 익혀 속도를 올리고, "기술자"가 아니라 "연출하는 편집자"로 자리 잡기'],
'유튜브 PD':['자료 조사, 대본 초안, 업로드·썸네일 문구 정리','채널의 색을 정하고 출연자와 합을 맞추는 일','데이터(조회수·잔존율)를 읽는 눈을 키우면 대체가 아니라 AI를 부리는 쪽이 돼요'],
'방송 PD':['편성표 정리, 자막·CG 지시서 같은 서류 작업','현장을 지휘하고 출연자·스태프를 한 방향으로 모으는 일','현장 경험을 최대한 많이 쌓기. 사람을 움직이는 능력은 AI가 못 따라와요'],
'촬영감독':['기본 구도 추천, 노출·포커스 같은 자동화 가능한 설정','현장 빛을 읽고 감독 의도를 그림으로 바꾸는 감각','장비보다 "왜 이렇게 찍었는지" 설명할 수 있는 연출 감각 키우기'],
'촬영기사':['고정 앵글·반복 촬영, 단순 B롤 촬영','현장 변수에 맞춰 순간적으로 움직이는 카메라 워크','짐벌·드론·특수 촬영처럼 손이 많이 가는 기술을 하나 이상 확실히'],
'조명감독':['조명 배치 시뮬레이션, 색온도 계산','현장 공간과 배우 얼굴에 맞춰 빛을 다듬는 일','빛을 보는 눈은 현장에서만 늘어요. 현장 경험이 곧 경쟁력'],
'영화감독':['콘티 초안, 레퍼런스 정리, 일정표 작성','이야기의 방향을 정하고 배우의 연기를 끌어내는 일','AI로 콘티·프리비즈를 빨리 만들고, 남는 시간을 "내 이야기"에 쓰기'],
'시나리오 작가':['줄거리 초안, 대사 다듬기, 자료 조사','나만의 경험과 시선에서 나오는 이야기','AI 초안은 누구나 뽑아요. 내 경험을 기록하는 습관이 무기'],
'방송작가':['자료 조사, 섭외 리스트, 큐시트 초안','출연자를 인터뷰하고 웃음·감동 포인트를 짜는 일','사람 이야기를 끌어내는 인터뷰 능력에 집중하기'],
'콘텐츠 기획자':['트렌드 조사, 기획안 초안, 캡션 작성','타깃이 진짜 원하는 걸 찾아내는 감과 결정','"무엇을 만들지 고르는 눈"이 핵심. 많이 보고 많이 기획해 보기'],
'유튜버':['편집, 썸네일, 자막, 대본 초안','얼굴·목소리·캐릭터, 그리고 시청자와의 관계','AI로 제작 시간을 줄이고, 그 시간을 소통과 캐릭터 만들기에 쓰기'],
'스트리머':['하이라이트 편집, 채팅 관리, 방송 일정 공지','실시간으로 시청자와 노는 능력과 캐릭터','AI가 흉내 내기 가장 어려운 건 "실시간 리액션". 소통에 올인'],
'썸네일 디자이너':['배경 합성, 누끼, 기본 레이아웃','클릭을 부르는 한 장면을 고르는 감각','디자인 툴보다 "어떤 썸네일이 왜 터졌는지" 분석하는 능력 키우기'],
'모션그래픽 디자이너':['템플릿형 모션, 단순 자막 애니메이션','브랜드에 맞는 움직임의 느낌을 설계하는 일','AI 생성 영상을 다룰 줄 아는 모션 디자이너가 되기'],
'VFX 아티스트':['로토스코핑, 배경 지우기, 단순 합성','장면 전체의 리얼함을 판단하고 마무리하는 눈','AI 툴을 파이프라인에 넣는 쪽(기술 감독)으로 성장하기'],
'3D 모델러':['기본 형태 모델링, 텍스처 생성','캐릭터·공간의 디자인 의도를 정하는 일','모델링만 하기보다 콘셉트·디자인까지 할 줄 아는 사람 되기'],
'애니메이터':['중간 프레임 그리기, 립싱크 같은 반복 작업','캐릭터에 감정을 넣는 연기와 타이밍','연기 감각(타이밍·과장)을 공부하면 오래가요'],
'컬러리스트':['기본 색 맞춤, 장면 간 색 통일','작품 분위기를 색으로 정하는 감각과 감독과의 소통','"왜 이 색인지" 말로 설명할 수 있는 컬러리스트 되기'],
'사운드 디자이너':['노이즈 제거, 기본 효과음 배치, 음량 맞춤','장면 감정에 맞는 소리를 고르고 만드는 감각','공간·감정을 소리로 설계하는 쪽으로 깊어지기'],
'녹음기사':['노이즈 정리, 레벨 자동 조절','현장 소리를 상황에 맞게 잡아내는 일','현장 동시녹음 경험은 AI가 대신할 수 없어요'],
'작곡가':['BGM 초안, 반주 생성','작품과 사람을 이해하고 거기에 맞는 음악을 만드는 일','AI 음악은 넘쳐나요. 협업하는 사람과의 관계가 일감을 만들어요'],
'성우':['내레이션, 안내 음성, 단순 더빙','캐릭터에 생명을 넣는 연기','목소리보다 "연기"로 승부. 캐릭터 연기 영역으로'],
'자막 번역가':['자동 번역, 타임코드 싱크','문화 차이를 살린 번역과 말맛','번역보다 "현지화 감수" 쪽으로 역할을 넓히기'],
'광고 감독':['콘티 초안, 레퍼런스 영상 생성','브랜드와 소비자 사이의 아이디어를 만드는 일','AI 영상 광고를 직접 만들어 볼 줄 아는 감독이 앞서가요'],
'SNS 마케터':['게시물 문구, 해시태그, 예약 업로드, 리포트','브랜드 색을 정하고 트렌드에 올라탈 타이밍을 고르는 일','AI로 운영을 자동화하고, 기획과 데이터 해석에 집중하기'],
'시각디자이너':['배너·카드뉴스 같은 정형화된 디자인','브랜드 방향을 정하고 시안을 고르는 눈','"만드는 사람"에서 "고르고 방향 잡는 사람"으로 성장하기'],
'사진작가':['보정, 누끼, 상품 사진','사람을 편하게 만들어 진짜 표정을 끌어내는 일','현장 촬영·인물 촬영 쪽 경험 쌓기'],
'배우':['단역·엑스트라, 광고 모델 일부','사람의 감정을 몸과 얼굴로 전달하는 연기','실제 무대·현장에서 쌓는 연기 경험이 가장 큰 무기'],
'기자':['단신 기사, 자료 정리, 받아쓰기','현장 취재, 사람을 만나 사실을 확인하는 일','현장 취재력과 검증 능력이 핵심'],
'아나운서':['정해진 원고 읽기, 안내 방송','현장 진행, 돌발 상황 대처, 사람과의 호흡','진행 능력(애드리브·인터뷰)을 키우기'],
'가수':['데모곡 가이드 녹음, 코러스','무대 위 퍼포먼스와 팬과의 관계','라이브·무대 경험이 대체 불가'],
'게임 개발자':['반복 코드, 테스트, 리소스 변환','게임의 재미를 설계하고 문제를 해결하는 판단','AI 코딩 도구를 잘 쓰는 개발자가 가장 먼저 살아남아요'],
'종합편집 기사':['자막·CG 얹기, 규격 맞추기, 송출 파일 변환','방송 직전 전체 흐름을 마지막으로 책임지는 판단','방송 규격·심의를 깊이 아는 사람이 오래 살아남아요'],
'포스트 프로덕션 슈퍼바이저':['일정표, 작업 배분, 진행 상황 정리','편집·색·사운드·CG 팀을 한 방향으로 묶는 일','후반작업 전 과정을 한 번씩 다 해 보는 게 최고의 준비'],
'폴리 아티스트':['효과음 라이브러리에서 골라 붙이기','화면에 딱 맞는 소리를 몸으로 만들어 내는 일','"이 소리 어떻게 냈지?" 싶은 나만의 소리 노하우 쌓기'],
'DIT':['데이터 백업, 파일 변환, 기본 LUT 적용','현장에서 화면 품질 문제를 바로 잡아내는 눈','카메라·색 지식을 함께 갖추면 컬러리스트로도 갈 수 있어요'],
'조연출':['일정표, 콜시트, 촬영 리스트 정리','현장을 뛰어다니며 사람과 상황을 조율하는 일','현장 경험이 곧 연출 실력. 최대한 많은 현장 겪기'],
'다큐멘터리 감독':['자료 조사, 인터뷰 받아쓰기, 가편집','대상의 삶에 들어가 믿음을 얻고 진짜 이야기를 찾는 일','오래 관찰하고 사람과 친해지는 힘이 무기'],
'뮤직비디오 감독':['레퍼런스 정리, 콘티 초안, AI 비주얼 시안','아티스트의 색을 영상으로 바꾸는 아이디어','AI 비주얼을 잘 섞어 쓰는 감독이 먼저 뜨고 있어요'],
'영화 프로듀서':['예산표, 일정표, 계약 서류 초안','사람과 돈을 모아 작품을 끝까지 완성시키는 일','사람 네트워크와 결정력이 핵심'],
'캐스팅 디렉터':['배우 프로필 정리, 오디션 일정 관리','작품에 딱 맞는 사람을 알아보는 눈','많은 배우를 직접 만나 보는 경험이 쌓일수록 강해져요'],
'연예인 매니저':['스케줄 정리, 이동 동선, 연락 관리','아티스트를 지키고 믿음을 주는 일','사람을 챙기는 능력은 AI가 대신 못 해요'],
'드론 촬영 기사':['자동 비행 경로 촬영, 단순 항공샷','위험한 현장에서 판단하며 원하는 그림을 만드는 일','드론 자격증 + 특수 촬영 경험을 같이 갖추기'],
'영상 기자':['단순 스케치 영상, 자료 화면 정리','사건 현장에서 순간을 놓치지 않는 판단','현장 취재 경험과 빠른 판단력이 핵심'],
'중계 기술감독':['기본 화면 전환, 그래픽 자동 송출','생방송 사고를 막고 순간적으로 화면을 고르는 일','생방송 경험은 아무나 못 쌓아요. 기회가 오면 무조건 잡기'],
'방송 엔지니어':['송출 모니터링, 장비 상태 체크','장비 문제를 현장에서 바로 해결하는 일','네트워크·IP 방송 기술까지 알면 오래가요'],
'무대감독':['큐시트 정리, 무대 전환 일정','공연을 실시간으로 지휘하는 판단과 리더십','현장 경험과 사람을 움직이는 리더십 키우기'],
'미술감독':['콘셉트 이미지 시안, 레퍼런스 정리','작품의 세계를 공간으로 만들고 고르는 눈','AI 시안을 빨리 뽑고, 실제 공간으로 만드는 능력에 집중'],
'메이크업 아티스트':['메이크업 시뮬레이션, 제품 추천','사람 얼굴과 카메라에 맞춰 손으로 완성하는 일','특수분장처럼 손기술이 깊은 영역으로'],
'스타일리스트':['코디 추천, 쇼핑 리스트 정리','사람과 작품에 맞는 분위기를 고르는 감각','트렌드를 읽는 눈과 브랜드 네트워크가 무기'],
'방송 CG 디자이너':['자막 템플릿, 단순 그래픽 송출','프로그램 분위기에 맞는 그래픽 톤을 정하는 일','템플릿 작업에서 벗어나 "그래픽 디렉팅"으로 성장하기'],
'스토리보드 아티스트':['콘티 초안 이미지 생성','감독 의도를 장면 순서와 구도로 바꾸는 연출 감각','그림 실력보다 "연출 감각"을 키우는 게 오래가요'],
'캐릭터 디자이너':['시안 대량 생성, 컬러 바리에이션','사랑받을 캐릭터의 성격과 이야기를 만드는 일','캐릭터에 이야기를 붙일 줄 아는 디자이너가 살아남아요'],
'편집 디자이너':['정형화된 레이아웃, 텍스트 배치','책·잡지 전체의 흐름과 분위기를 잡는 일','레이아웃 기술보다 "기획하는 디자이너"로'],
'UX 디자이너':['화면 시안, 기본 UI 구성','사용자를 관찰하고 불편함을 찾아내는 일','사용자 리서치·기획 능력을 같이 키우기'],
'미디어 아티스트':['영상 소스 생성, 반복 프로그래밍','공간과 관객을 생각한 경험 설계','기술과 예술을 섞는 나만의 스타일 만들기'],
'AI 영상 크리에이터':['프롬프트 작성, 단순 생성 작업 자체','어떤 장면이 사람 마음을 움직이는지 고르는 눈','툴은 매달 바뀌어요. 툴보다 "연출과 이야기"를 쌓기'],
'숏폼 크리에이터':['편집, 자막, 트렌드 음원 찾기','나만의 캐릭터와 첫 1초를 잡는 감각','AI로 제작 속도를 올리고, 캐릭터와 기획에 집중하기'],
'버추얼 유튜버':['아바타 움직임, 하이라이트 편집','캐릭터 뒤에 있는 진짜 사람의 리액션과 소통','AI 버튜버도 나오는 중이라 "사람다움"과 소통이 핵심'],
'모델':['광고 이미지 모델 일부(AI 모델로 대체 중)','현장에서 옷과 브랜드에 생명을 넣는 표현력','런웨이·라이브처럼 현장에서만 보여 줄 수 있는 쪽으로'],
'쇼호스트':['상품 설명 원고, 단순 안내 방송','실시간으로 시청자를 설득하는 말발과 순발력','라이브 커머스 경험을 쌓고 나만의 팬을 만들기'],
'광고 기획자':['시장 조사, 기획서 초안, 리포트','광고주를 설득하고 팀을 이끄는 일','사람을 설득하는 발표력과 전략적 사고 키우기'],
'카피라이터':['카피 시안 대량 생성','수많은 시안 중 "이거다" 하는 한 줄을 고르는 감각','AI 시안을 고르고 다듬는 "편집자형 카피라이터"로'],
'영화 마케터':['보도자료 초안, SNS 게시물, 데이터 정리','관객이 극장에 올 이유를 만드는 아이디어','트렌드와 커뮤니티 반응을 읽는 눈 키우기'],
'마케터':['광고 문구, 리포트, 반복 운영 업무','브랜드 전략을 세우고 결정하는 일','데이터와 사람 마음을 함께 읽는 마케터 되기'],
'교사':['수업 자료·시험 문제 만들기, 채점, 행정 서류','학생 한 명 한 명을 살피고 성장시키는 일','AI를 수업 도구로 먼저 쓰는 선생님이 학생들과 더 가까워져요'],
'웹툰 작가':['채색, 배경, 선 정리','캐릭터와 이야기, 연재를 이어가는 힘','AI로 작업 시간을 줄이고 이야기에 더 집중하기'],
'일러스트레이터':['배경, 소품, 단순 일러스트','나만의 그림체와 세계관','그림체를 "브랜드"로 만드는 게 핵심']};
const FIELD = { '연': '연출·기획', '촬': '촬영·현장', '후': '후반작업', '디': '디자인·그래픽', '출': '출연·크리에이터', '마': '마케팅·광고', g: '유명 직업' };
const PICK = ['영상 편집자', '촬영감독', '유튜버', '방송 PD', '컬러리스트', 'VFX 아티스트', '시각디자이너', '숏폼 크리에이터', '교사'];
const LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="5" y="12" width="54" height="40" rx="9" fill="#173048" stroke="#173048" stroke-width="4.5"/><g fill="#ffe08a"><rect x="23" y="18" width="18" height="4" rx="2" opacity=".3"/><rect x="17" y="25.5" width="30" height="4" rx="2" opacity=".55"/><rect x="24" y="33" width="16" height="4" rx="2" opacity=".8"/><rect x="19" y="40.5" width="26" height="4" rx="2"/></g></svg>';

const TMIN = -12.5, TMAX = 8.5, YMIN = 0.35, YMAX = 32;
function calcYears([R, D, C, P, H, L]) {
  const E = (1.3 * R + 1.1 * D) - (0.7 * C + 1.0 * P + 0.8 * H + 0.7 * L);
  const t = Math.min(1, Math.max(0, (E - TMIN) / (TMAX - TMIN)));   // 0=안전 1=노출
  return Math.round(YMAX * Math.pow(YMIN / YMAX, Math.pow(t, 1.5)) * 100) / 100;
}
const JOBS = RAW.trim().split('\n').map(l => { const [n, c, a, f] = l.split('|'); const v = f.split(' ').map(Number); return { n, c, a: a ? a.split(',') : [], f: v, y: calcYears(v) }; });
const norm = s => s.toLowerCase().replace(/\s/g, '');
const find = q => { const k = norm(q); if (!k) return null; return JOBS.find(j => norm(j.n) === k) || JOBS.find(j => j.a.some(a => norm(a) === k)) || null; };
const suggest = q => { const k = norm(q); if (!k) return []; return JOBS.filter(j => norm(j.n).includes(k) || j.a.some(a => norm(a).includes(k))).slice(0, 6); };
function fmtY(y) {
  if (y >= 30) return { t: '30년 이상', h: '30<small>년</small> 이상' };
  const m = Math.max(1, Math.round(y * 12)), yy = Math.floor(m / 12), mm = m % 12;
  if (!yy) return { t: mm + '개월', h: mm + '<small>개월</small>' };
  return { t: yy + '년' + (mm ? ' ' + mm + '개월' : ''), h: yy + '<small>년</small>' + (mm ? mm + '<small>개월</small>' : '') };
}
const RISK = [[1, '매우 높음', 'r1', 95], [3, '높음', 'r2', 75], [8, '보통', 'r3', 52], [18, '낮음', 'r4', 30], [1e9, '매우 낮음', 'r5', 12]];
const RCOL = { r1: '#ff6b6b', r2: '#ffa45c', r3: '#ffd25e', r4: '#5fd38a', r5: '#6fc6f4' };
const risk = y => RISK.find(r => y < r[0]);
const endAt = y => { if (y >= 30) return '2056년 이후'; const d = new Date(); d.setMonth(d.getMonth() + Math.round(y * 12)); return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월쯤'; };
function genNote([R, D, C, P, H, L]) {
  const ai = D >= 4 && R >= 4 ? '정해진 형식으로 반복하는 화면 작업' : D >= 4 ? '자료 찾기, 초안 만들기, 정리하는 일' : R >= 4 ? '매번 같은 순서로 하는 단순 업무' : '서류·기록 정리 같은 보조 업무';
  const top = [[C, '새로운 걸 떠올리고 방향을 정하는 판단', 'AI로 초안은 빨리 뽑고, 그중 좋은 걸 고르는 "눈"을 키우기'], [P, '현장에서 몸으로 하는 섬세한 일', '현장 경험을 쌓을수록 대체가 늦어져요. 실습·자격 위주로'], [H, '사람을 직접 상대하고 믿음을 주는 일', '소통 능력이 무기. 발표·상담·협업 경험을 많이 쌓기'], [L, '결과에 책임을 지고 판단하는 일', '자격과 책임이 방패예요. 전문 자격을 목표로']].sort((a, b) => b[0] - a[0])[0];
  return [ai, top[1], (R + D >= 8 ? 'AI 툴을 남들보다 먼저 쓰는 쪽이 살아남아요. ' : '') + top[2]];
}
const QS = [
  ['이 일은 매번 비슷한 순서로 반복되나요?', ['거의 매번 똑같아요', 5], ['반반이에요', 3], ['매번 달라요', 1]],
  ['결과물이 컴퓨터 화면 안에서 끝나나요?', ['대부분 화면 안에서 끝나요', 5], ['반반이에요', 3], ['실물·현장이 대부분이에요', 1]],
  ['새로운 아이디어나 방향을 직접 정하나요?', ['자주 정해요', 5], ['가끔 정해요', 3], ['거의 안 정해요', 1]],
  ['몸을 써서 현장에서 일하나요?', ['대부분 현장이에요', 5], ['가끔 현장에 가요', 3], ['거의 책상에서 해요', 1]],
  ['사람을 직접 만나고 상대하는 일이 많나요?', ['하루 종일 사람을 만나요', 5], ['가끔 만나요', 3], ['거의 혼자 일해요', 1]],
  ['자격증이나 법적 책임이 필요한 일인가요?', ['자격증이 꼭 있어야 해요', 5], ['있으면 좋아요', 3], ['필요 없어요', 1]]
];

let box = null, cur = null, cat = 'v', ord = 'asc', all = false, busy = false;
const q$ = s => box.querySelector(s);

export function render(el) {
  if (!el) return;
  if (box === el && el.firstChild) return;   // 다시 들어와도 결과 그대로
  box = el;
  el.innerHTML = `<div class="ec">
  <section class="card ec-hero">
    <div class="ec-brand">${LOGO}<b class="disp">엔딩 크레딧</b></div>
    <h3 class="disp">내 직업, 내 꿈의 직업<br><em>엔딩 크레딧</em>은 언제 올라갈까?</h3>
    <p class="ec-sub">지금 하는 일이나 꿈꾸는 직업을 입력하면 AI가 그 일을 대신하기까지 남은 시간을 알려 줘요</p>
    <form class="ec-search" id="ecForm" autocomplete="off">
      <input id="ecQ" maxlength="30" placeholder="예) 영상 편집자, 컬러리스트, 의사" aria-label="직업 입력">
      <button class="btn" type="submit">상영 시작</button>
      <div class="ec-sug" id="ecSug" hidden></div>
    </form>
    <div class="ec-chips" id="ecChips">${PICK.map(n => `<button type="button" class="chip" data-ecj="${esc(n)}">${esc(n)}</button>`).join('')}<button type="button" class="chip ec-rand" data-ecr>랜덤 직업</button></div>
  </section>
  <div id="ecOut"></div>
  <section class="card ec-rank">
    <div class="ec-rh"><h3 class="disp">직업 순위</h3>
      <div class="ec-tabs" id="ecCat"><button type="button" data-v="v" class="on">영상고 진로</button><button type="button" data-v="g">유명 직업</button><button type="button" data-v="all">전체</button></div>
      <div class="ec-tabs" id="ecOrd"><button type="button" data-v="asc" class="on">빨리 끝나는 순</button><button type="button" data-v="desc">오래가는 순</button></div>
    </div>
    <div class="ec-list" id="ecList"></div>
  </section>
  <details class="card ec-how"><summary>숫자는 어떻게 나오나요?</summary>
    <p>AI 대체 가능성 연구들이 공통으로 보는 기준을 6가지로 묶고, 직업마다 1~5점을 매겨 계산해요.</p>
    <ul><li><b>빨라지게 하는 것</b> · 반복성(매번 같은 순서로 하는 일) · 화면 안 작업(결과물이 디지털로 끝나는 일)</li>
    <li><b>늦어지게 하는 것</b> · 창의·판단 · 현장·몸 · 사람·신뢰 · 책임·자격</li></ul>
    <p>두 쪽 점수의 차이로 '노출도'를 구하고 남은 기간(약 4개월 ~ 30년 이상)으로 바꿔요. 목록에 없는 직업은 6가지 질문으로 같은 공식을 써요.</p>
    <p><b>재미로 보는 추정치예요.</b> 같은 직업도 어떤 일을 하느냐에 따라 완전히 달라지고, AI는 일을 없애기보다 일하는 방식을 바꾸는 경우가 더 많아요. 숫자보다 '끝까지 사람이 하는 일'을 눈여겨봐 주세요.</p>
  </details>
  <div class="ec-leader" id="ecLead" hidden><div class="ec-ring" id="ecRing"><i></i><b id="ecNum">3</b></div></div>
  <div class="ec-modal" id="ecModal" hidden><img id="ecImg" alt="엔딩 크레딧 결과 카드"><p>이미지를 길게 누르거나 우클릭해서 저장해도 돼요</p><div class="ec-mrow"><a class="btn" id="ecDl" download="ending-credit.png">이미지 저장</a><button type="button" class="btn ghost" id="ecClose">닫기</button></div></div>
</div>`;
  bind(); drawList();
}

function bind() {
  const q = q$('#ecQ'), sug = q$('#ecSug');
  let sel = -1;
  q.addEventListener('input', () => {
    const s = suggest(q.value); sel = -1;
    if (!s.length) { sug.hidden = true; return; }
    sug.innerHTML = s.map(j => `<button type="button" data-ecj="${esc(j.n)}"><span>${esc(j.n)}</span><small>${fmtY(j.y).t}</small></button>`).join('');
    sug.hidden = false;
  });
  q.addEventListener('keydown', e => {
    const bs = [...sug.querySelectorAll('button')]; if (sug.hidden || !bs.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length; bs.forEach((b, i) => b.classList.toggle('on', i === sel)); }
    else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); sug.hidden = true; run(find(bs[sel].dataset.ecj)); }
    else if (e.key === 'Escape') sug.hidden = true;
  });
  q$('#ecForm').addEventListener('submit', e => {
    e.preventDefault(); sug.hidden = true;
    const v = q.value.trim(); if (!v) { q.focus(); return; }
    const s = suggest(v), j = find(v) || (s.length === 1 ? s[0] : null);
    j ? run(j) : quiz(v);
  });
  box.addEventListener('click', e => {
    const t = e.target;
    if (!t.closest('.ec-search')) sug.hidden = true;
    const j = t.closest('[data-ecj]'); if (j) { sug.hidden = true; run(find(j.dataset.ecj)); return; }
    if (t.closest('[data-ecr]')) { run(JOBS[Math.floor(Math.random() * JOBS.length)]); return; }
    const tab = t.closest('.ec-tabs button');
    if (tab) { const g = tab.parentElement; g.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === tab)); if (g.id === 'ecCat') cat = tab.dataset.v; else ord = tab.dataset.v; all = false; drawList(); return; }
    if (t.closest('#ecMore')) { all = !all; drawList(); return; }
    if (t.closest('#ecClose') || t.id === 'ecModal') q$('#ecModal').hidden = true;
  });
}

function leader() {
  return new Promise(res => {
    const L = q$('#ecLead'), ring = q$('#ecRing'), num = q$('#ecNum');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { res(); return; }
    L.hidden = false; let n = 3, st = performance.now(); num.textContent = n;
    const f = t => {
      const p = (t - st) / 420; ring.style.setProperty('--a', Math.min(360, p * 360) + 'deg');
      if (p >= 1) { n--; if (!n || !L.isConnected) { L.hidden = true; res(); return; } num.textContent = n; st = t; }
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
}

async function run(j, custom) {
  if (!j || busy) return;
  busy = true;
  try { await leader(); } finally { busy = false; }
  cur = j;
  const y = j.y, f = fmtY(y), [, rl, rk, rp] = risk(y);
  const [ai, hu, tip] = NOTE[j.n] || genNote(j.f);
  const out = q$('#ecOut');
  out.innerHTML = `<section class="card ec-res ${rk}">
    <div class="ec-top"><div>${FIELD[j.c] ? `<span class="ec-field">${FIELD[j.c]}</span>` : `<span class="ec-field">직접 계산</span>`}<h3 class="disp">${esc(j.n)}</h3></div><span class="ec-badge">대체 위험 ${rl}</span></div>
    <p class="ec-lbl">AI가 이 일을 대신하기까지</p>
    <p class="ec-num">${f.h}</p>
    <p class="ec-date"><b>${endAt(y)}</b> 엔딩 크레딧이 올라가요</p>
    <div class="ec-meter"><i id="ecBar"></i></div><div class="ec-ml"><span>오래 살아남음</span><span>곧 대체</span></div>
    <div class="ec-split"><div class="ec-box"><h4>AI가 먼저 가져갈 일</h4><p>${esc(ai)}</p></div><div class="ec-box"><h4>끝까지 사람이 하는 일</h4><p>${esc(hu)}</p></div></div>
    <div class="ec-tip"><h4>엔딩을 미루는 한 수</h4><p>${esc(tip)}</p></div>
    <div class="ec-acts"><button type="button" class="btn" id="ecCard">결과 카드 만들기</button><button type="button" class="btn ghost" id="ecCopy">결과 복사</button><button type="button" class="btn ghost" id="ecAgain">다른 직업</button></div>
  </section>`;
  out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  requestAnimationFrame(() => requestAnimationFrame(() => { const b = q$('#ecBar'); if (b) b.style.width = rp + '%'; }));
  q$('#ecCard').onclick = makeCard;
  q$('#ecCopy').onclick = () => copy(`🎬 엔딩 크레딧\n"${j.n}", AI 대체까지 ${f.t}\n${endAt(y)} 엔딩 크레딧이 올라간대요 (대체 위험 ${rl})\nSVMHS GROUND에서 같이 해 봐요 👉 ${location.origin}`);
  q$('#ecAgain').onclick = () => { const q = q$('#ecQ'); q.value = ''; q$('.ec-hero').scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => q.focus(), 350); };
  try { const h = store.get('ec_hist', []); store.set('ec_hist', [j.n, ...h.filter(x => x !== j.n)].slice(0, 10)); } catch {}
}

function quiz(name) {
  const out = q$('#ecOut'), ans = []; let i = 0;
  const draw = () => {
    const [t, ...o] = QS[i];
    out.innerHTML = `<section class="card ec-quiz"><h3 class="disp">"${esc(name)}"은(는) 목록에 없어요</h3><p class="ec-sub">6가지만 답하면 같은 공식으로 계산해 드려요 (${i + 1}/6)</p>
      <div class="ec-meter"><i id="ecQb"></i></div><p class="ec-qt">${t}</p>
      <div class="ec-opts">${o.map((x, k) => `<button type="button" class="btn ghost" data-k="${k}">${x[0]}</button>`).join('')}</div></section>`;
    q$('#ecQb').style.width = (i / 6 * 100) + '%';
    out.querySelectorAll('.ec-opts button').forEach(b => b.onclick = () => {
      ans.push(o[+b.dataset.k][1]); i++;
      if (i < 6) draw(); else run({ n: name, c: 'x', a: [], f: ans, y: calcYears(ans) }, true);
    });
  };
  draw(); out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function drawList() {
  let l = JOBS.filter(j => cat === 'all' || (cat === 'v' ? j.c !== 'g' : j.c === 'g')).sort((a, b) => ord === 'asc' ? a.y - b.y : b.y - a.y);
  const total = l.length; if (!all) l = l.slice(0, 10);
  q$('#ecList').innerHTML = l.map((j, i) => { const [, rl, rk] = risk(j.y); return `<button type="button" class="ec-item ${rk}" data-ecj="${esc(j.n)}"><span class="ec-n">${i + 1}</span><span class="ec-nm">${esc(j.n)}<small>${FIELD[j.c]} · ${endAt(j.y)}</small></span><span class="ec-y">${fmtY(j.y).t}<small>${rl}</small></span></button>`; }).join('')
    + (total > 10 ? `<button type="button" class="ec-more" id="ecMore">${all ? '접기' : '전체 ' + total + '개 보기'}</button>` : '');
}

// 결과 카드(1080×1350) — 스티커 보드 느낌: 하늘색 점 배경 + 굵은 테두리 카드
async function makeCard() {
  try { await document.fonts.ready; } catch {}
  const j = cur; if (!j) return;
  const y = j.y, f = fmtY(y), [, rl, rk] = risk(y);
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d');
  const ink = '#173048', disp = '"Jua","Pretendard Variable",Pretendard,sans-serif', sans = '"Pretendard Variable",Pretendard,sans-serif';
  x.fillStyle = '#eaf5fd'; x.fillRect(0, 0, 1080, 1350);
  x.fillStyle = 'rgba(30,110,180,.16)'; for (let yy = 20; yy < 1350; yy += 44) for (let xx = 20; xx < 1080; xx += 44) { x.beginPath(); x.arc(xx, yy, 3.2, 0, 7); x.fill(); }
  const rr = (a, b, w, h, r) => { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); };
  x.save(); x.translate(540, 700); x.rotate(-0.012); x.translate(-540, -700);
  x.fillStyle = ink; rr(98, 218, 900, 960, 48); x.fill();
  x.fillStyle = '#fff'; rr(84, 204, 900, 960, 48); x.fill(); x.lineWidth = 6; x.strokeStyle = ink; x.stroke();
  x.restore();
  x.fillStyle = '#ffe08a'; x.save(); x.translate(540, 210); x.rotate(-0.05); x.globalAlpha = .9; x.fillRect(-120, -26, 240, 52); x.restore();
  const lg = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = 'data:image/svg+xml,' + encodeURIComponent(LOGO.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); });
  x.font = '60px ' + disp; const tw = x.measureText('엔딩 크레딧').width, lx = 540 - (tw + 92) / 2;
  if (lg) x.drawImage(lg, lx, 92, 78, 78);
  x.fillStyle = ink; x.textAlign = 'left'; x.fillText('엔딩 크레딧', lx + 92, 152); x.textAlign = 'center';
  x.fillStyle = '#4a5f74'; x.font = '700 36px ' + sans; x.fillText('AI가 이 일을 대신하기까지', 534, 340);
  x.fillStyle = ink; x.font = (j.n.length > 9 ? '72px ' : '88px ') + disp; x.fillText(j.n, 534, 460);
  x.font = (f.t.length > 7 ? '150px ' : '190px ') + disp; x.lineWidth = 14; x.strokeStyle = ink; x.lineJoin = 'round'; x.strokeText(f.t, 534, 700); x.fillStyle = '#ffe08a'; x.fillText(f.t, 534, 700);
  x.fillStyle = ink; x.font = '700 42px ' + sans; x.fillText(endAt(y) + ' 엔딩', 534, 800);
  const bw = 440; x.fillStyle = ink; rr(534 - bw / 2 + 6, 866, bw, 88, 44); x.fill(); x.fillStyle = RCOL[rk]; rr(534 - bw / 2, 860, bw, 88, 44); x.fill(); x.lineWidth = 5; x.stroke();
  x.fillStyle = ink; x.font = '900 40px ' + sans; x.fillText('대체 위험 ' + rl, 534, 918);
  x.fillStyle = '#4a5f74'; x.font = '700 32px ' + sans; x.fillText('당신의 엔딩은 언제일까요?', 534, 1070);
  x.fillStyle = ink; x.font = '700 30px ' + sans; x.fillText('SVMHS GROUND · 재미로 보는 추정치', 540, 1270);
  const url = c.toDataURL('image/png');
  q$('#ecImg').src = url; q$('#ecDl').href = url; q$('#ecDl').download = 'ending-credit-' + j.n.replace(/\s/g, '') + '.png';
  q$('#ecModal').hidden = false;
}

function copy(t) {
  const ok = () => toast('복사했어요! 친구에게 붙여넣어 보세요');
  const fb = () => { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); ok(); } catch { toast('복사가 안 돼요'); } a.remove(); };
  try { navigator.clipboard.writeText(t).then(ok, fb); } catch { fb(); }
}
