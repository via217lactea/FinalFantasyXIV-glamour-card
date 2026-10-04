# 배포 (Cloudflare Pages)

## 0. 먼저 — 스프라이트부터

아이콘을 개별 파일로 올리면 **배포가 거부된다.** Cloudflare Pages 무료 플랜은 배포당
파일 20,000개가 상한인데 아이콘만 19,000개가 넘는다.

```bash
npm run build:icons -- --from "<SaintCoinach 날짜폴더>/ui/icon"
npm run build:sprites
npm run check:sprites
npm run check:deploy
```

`check:sprites`는 매니페스트와 시트가 맞는지, `check:deploy`는 실제 빌드 산출물이 호스트
한계 안에 드는지 본다. 파일 수가 **331개 안팎**이면 정상이다.

`icons/`는 git에 올리지 않는다 (`.gitignore`에 들어 있다). 올라가는 건
`public/sprites/`와 `public/data/`다.

원본이 빌드에 섞여 들어가지 않도록 세 겹으로 막아 둔다. 원본을 `public/` 바깥에 두고,
`.gitignore`에 넣고(Vite는 `public/` 복사 시 gitignore된 경로를 건너뛴다), `check:deploy`가
빌드 산출물에 `icons/`가 있는지 확인한다.

## 1. GitHub에 올리기

```bash
git init
git add .
git commit -m "FF14 투영 카드 메이커"
```

GitHub에서 빈 저장소를 만들고, 거기 안내되는 `git remote add` / `git push` 두 줄을
그대로 실행한다.

올라가는 용량은 스프라이트 때문에 **수십 MB 수준**이다. 개별 아이콘 73MB를 올리던
것에 비하면 가볍다.

## 2. Cloudflare Pages 연결

1. [dash.cloudflare.com](https://dash.cloudflare.com) 가입 (무료)
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. GitHub 계정을 연결하고 저장소 선택
4. 빌드 설정

   | 항목 | 값 |
   |---|---|
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

5. **Save and Deploy**

몇 분 뒤 `<프로젝트명>.pages.dev` 주소가 나온다. 이후로는 `git push`만 하면 자동으로
다시 배포된다.

## 3. 확인할 것

- 아이콘이 보이는가 (안 보이면 `public/sprites`가 커밋됐는지 확인)
- PNG 저장에서 한글이 네모로 나오지 않는가
- 공유 링크를 새 탭에서 열면 코디가 복원되는가

## 라우팅 설정이 필요 없는 이유

공유 링크가 쿼리스트링이 아니라 `#c=...` **조각**을 쓴다. 조각은 서버로 전송되지 않으므로
`_redirects` 같은 SPA 라우팅 설정 없이도 어떤 경로로 들어오든 동작한다.

## 캐시

`public/_headers`가 스프라이트와 데이터의 캐시 수명을 정한다. 둘 다 파일명에 해시가 없고
패치 단위로만 바뀌므로 영구 캐시 대신 재검증을 쓴다. `/assets/` 아래 해시 붙은 빌드
산출물은 Cloudflare가 알아서 영구 캐시한다.

## 패치가 나오면

```bash
npm run build:data
npm run check:icons      # 새로 필요한 아이콘 목록
npm run fill:icons       # 빠진 것만 Lodestone에서 보충
npm run build:sprites    # 시트 다시 굽기
git add . && git commit -m "patch 7.x" && git push
```

주간 워크플로(`.github/workflows/refresh-data.yml`)가 앞 세 단계를 자동으로 돌려 PR을
연다. 스프라이트 재생성은 아이콘 원본이 로컬에만 있으므로 직접 해야 한다.

## 파일 수가 다시 늘면

`check:sprites`가 경고한다. 그때 선택지는 둘이다.

- 시트당 아이콘 수를 늘린다 (`scripts/build-sprites.ts`의 `PER_SHEET`). 파일은 줄지만
  카드 한 장당 전송량과 내보내기 비용이 커진다.
- 유료 플랜으로 올린다. 상한이 100,000개가 되며, 프로젝트 설정에
  `PAGES_WRANGLER_MAJOR_VERSION=4` 환경 변수를 넣어야 적용된다.

## 광고를 붙이면 안 된다

스퀘어에닉스 자료 이용 허락 조건상 판매·상업적 이용·광고 수익이 금지된다. Cloudflare
Pages 무료 플랜은 광고를 삽입하지 않으므로 그대로 쓰면 된다.
