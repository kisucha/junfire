// scripts/patch-react-pdf.js
// 목적: @react-pdf/renderer 번들된 reconciler에 React 18.3+ transitional element 지원 추가
// 문제: Next.js RSC 컴파일러가 Symbol.for("react.transitional.element") 사용
//       @react-pdf reconciler는 Symbol.for("react.element")만 처리 → error #31
// 해결: react-pdf.js 파일에 transitional element 케이스 추가
// 실행: node scripts/patch-react-pdf.js [target-dir]
//       target-dir 없으면 node_modules, standalone 양쪽 패치

'use strict';
const fs = require('fs');
const path = require('path');

const TRANSITIONAL_SYMBOL = 'Symbol.for("react.transitional.element")';

// 패치 대상 파일 경로 목록
const targets = [
  path.join(__dirname, '..', 'node_modules', '@react-pdf', 'renderer', 'lib', 'react-pdf.js'),
  path.join(__dirname, '..', '.next', 'standalone', 'node_modules', '@react-pdf', 'renderer', 'lib', 'react-pdf.js'),
];

/**
 * react-pdf.js 파일에 transitional element 지원 추가
 *
 * 변경 내용:
 * 1. ca 상수 정의 뒤에 transitional 상수 추가
 * 2. $$typeof switch 내 'case ca:' 앞에 'case caT:' 추가 (fall-through)
 */
function patchFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('  SKIP (not found):', filePath);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  // 이미 패치된 파일이면 건너뜀
  if (content.includes('react.transitional.element')) {
    console.log('  ALREADY PATCHED:', filePath);
    return true;
  }

  // 1단계: ca 상수 정의 찾기 및 transitional 상수 추가
  // 원본: ca = u ? Symbol.for("react.element") : 60103,
  const caDefPattern = /\bca\s*=\s*u\s*\?\s*Symbol\.for\("react\.element"\)\s*:\s*60103,/;
  if (!caDefPattern.test(content)) {
    console.error('  ERROR: ca constant definition not found in', filePath);
    return false;
  }

  content = content.replace(
    caDefPattern,
    (match) => `${match}caT=u?Symbol.for("react.transitional.element"):0,`
  );
  console.log('  [1/2] ca 상수 뒤에 caT(transitional) 추가');

  // 2단계: $$typeof switch 내 'case ca:' 앞에 'case caT:' 추가
  // 패턴: switch(X.$$typeof){case ca: 또는 switch(a.$$typeof){case ca:
  // fall-through: case caT: case ca: 가 되도록
  const casePattern = /(\bswitch\s*\(\s*\w+\s*\.\s*\$\$typeof\s*\)\s*\{[^}]*?)(case ca:)/g;

  let matchCount = 0;
  content = content.replace(casePattern, (match, prefix, caseStr) => {
    // 이미 caT가 있으면 스킵
    if (prefix.includes('caT')) return match;
    matchCount++;
    return `${prefix}case caT:${caseStr}`;
  });

  if (matchCount === 0) {
    console.warn('  WARN: no "case ca:" found in switch($$typeof) — trying broader pattern');

    // 더 넓은 패턴으로 시도: 파일 전체에서 case ca: 패턴 교체
    // (switch($$typeof) 내부인지 확인하기 어려우므로 문맥으로 판단)
    const casePattern2 = /(\$\$typeof[^;{]*?switch[^{]*\{[^}]*?)(case ca:)/g;
    content = content.replace(casePattern2, (match, prefix, caseStr) => {
      if (prefix.includes('caT')) return match;
      matchCount++;
      return `${prefix}case caT:${caseStr}`;
    });

    if (matchCount === 0) {
      console.error('  ERROR: could not find case ca: patterns');
      return false;
    }
  }

  console.log(`  [2/2] ${matchCount}개 'case ca:' 앞에 'case caT:' 추가`);

  // 백업 후 저장
  const backupPath = filePath + '.bak';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log('  백업 저장:', backupPath);
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('  PATCHED:', filePath);
  return true;
}

// 메인 실행
console.log('=== @react-pdf/renderer transitional element 패치 시작 ===\n');

let successCount = 0;
for (const target of targets) {
  console.log('대상:', target);
  if (patchFile(target)) successCount++;
  console.log();
}

console.log(`=== 완료: ${successCount}/${targets.length} 파일 패치 ===`);
