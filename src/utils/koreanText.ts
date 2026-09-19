// 안드로이드·iOS 줄바꿈 엔진은 한글을 음절(글자) 단위로 아무 데서나 끊을 수 있다고 본다 —
// 스페이스로 구분된 "단어"여도 그 안의 음절 사이에서 줄이 바뀌는 경우가 생긴다
// (예: "쓰는 동안에도"가 "쓰" / "는 동안에도"로 갈라짐). 인접한 완성형 한글 음절(가~힣) 사이에만
// WORD JOINER(폭 0, 줄바꿈 금지 문자)를 끼워 넣어 실제 스페이스 자리에서만 줄이 바뀌게 한다 —
// 웹의 word-break: keep-all과 같은 효과를 문자열 자체에 미리 적용하는 방식. 한글 음절로만
// 범위를 좁혀서, 이모지(서로게이트 쌍·변형 선택자)·숫자·영문처럼 건드리면 깨질 수 있는 문자는
// 전혀 손대지 않는다 — 모든 Text에 일괄 적용해도(components/Text.tsx) 안전하다.
const WORD_JOINER = '⁠';
const ADJACENT_HANGUL_SYLLABLES = /([가-힣])(?=[가-힣])/g;

export function keepWordsTogether(text: string): string {
  return text.replace(ADJACENT_HANGUL_SYLLABLES, `$1${WORD_JOINER}`);
}
