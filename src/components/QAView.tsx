import { usePracticeStore, eqChar, trimmedBounds } from '@/stores/practiceStore';
import type { ContentItem } from '@/types';
import { formatKeyCode, normalizeCode } from '@/utils/keycode';
import { useT } from '@/locales';

// 输入行里不可见字符的替身：空格必须能看见，否则错在哪都不知道
function displayChar(char: string, highlight: boolean): string {
  if (char === '\t') return '→';
  if (char !== ' ') return char;
  return highlight ? '_' : ' ';
}

/** 答案展示：text 直出文本，keypress 渲染按键徽章 */
function AnswerBody({ item }: { item: ContentItem }) {
  if (item.type === 'keypress') {
    const keys = item.content as string[];
    return (
      <div className="qa-answer-keys">
        {keys.map((code, i) => (
          <span key={i}>
            {i > 0 && <span className="key-plus">+</span>}
            <span className="key-badge">{formatKeyCode(code)}</span>
          </span>
        ))}
      </div>
    );
  }
  return <span className="qa-answer-text">{item.content as string}</span>;
}

/** 问答模式：只给问题，答案盲输后回车提交 */
export default function QAView({ isTyping }: { isTyping: boolean }) {
  const t = useT();
  const {
    items,
    currentItemIndex,
    freeTyped,
    caseInsensitive,
    qaPhase,
    qaSelected,
    qaPeeking,
    pressedKeys,
    peekAnswer,
  } = usePracticeStore();

  const item = items[currentItemIndex];
  if (!item) return null;

  const isKeypress = item.type === 'keypress';
  const answerVisible = qaPhase === 'wrong' || qaPeeking;

  // 提示语随作答阶段变化，始终告诉用户下一步该做什么
  let hint: string;
  if (qaPhase === 'wrong') {
    hint = isKeypress ? t('qa.hint.retryKeys') : t('qa.hint.retryText');
  } else if (isKeypress) {
    hint = t('qa.hint.keypress');
  } else {
    hint = t('qa.hint.text');
  }

  const renderInputLine = () => {
    if (isKeypress) {
      const normalizedPressed = new Set(pressedKeys.map(normalizeCode));
      const target = (item.content as string[]).map(normalizeCode);
      return (
        <div className="qa-keys-pressed">
          {pressedKeys.length === 0 ? (
            <span className="qa-keys-placeholder">{t('qa.pressPrompt')}</span>
          ) : (
            [...normalizedPressed].map((code, i) => (
              <span key={code}>
                {i > 0 && <span className="key-plus">+</span>}
                <span className={`key-badge ${target.includes(code) ? 'pressed' : 'wrong'}`}>
                  {formatKeyCode(code)}
                </span>
              </span>
            ))
          )}
        </div>
      );
    }

    const target = (item.content as string).trim();
    // 与 submitQA 用同一条首尾空白规则，否则重打时打个前导空格会整行飘红，
    // 而提交结论却是正确 —— 两处判定必须一致
    const { start, end } = trimmedBounds(freeTyped);
    return (
      <>
        {freeTyped.map((char, i) => {
          let cls = 'qa-char';
          let highlight = false;
          const trimmedOff = i < start || i >= end;
          if (qaPhase === 'correct') {
            cls += ' ok';
          } else if (qaPhase === 'wrong') {
            if (qaSelected) {
              // 判错瞬间：整串标红并选中，任意按键即覆盖重写
              cls += ' wrong selected';
              highlight = true;
            } else if (trimmedOff) {
              // 首尾空白判定时会被剥掉：淡显 + 占位符，让用户看见它存在且不计入
              cls += ' trimmed';
              highlight = true;
            } else if (!eqChar(char, target[i - start] ?? '', caseInsensitive)) {
              // 照着答案重打时逐字实时纠错（此时答案已可见，不存在泄露）
              cls += ' wrong';
              highlight = true;
            } else {
              cls += ' ok';
            }
          }
          // qaPhase === 'input'：盲输阶段一律中性色，任何着色都是答案泄露
          return (
            <span key={i} className={cls}>
              {displayChar(char, highlight)}
            </span>
          );
        })}
        {qaPhase !== 'correct' && (
          <span className={`qa-caret ${isTyping ? 'typing' : ''}`} />
        )}
      </>
    );
  };

  return (
    <div className="qa-view">
      <div className="qa-counter">
        {currentItemIndex + 1} / {items.length}
      </div>

      <div className="qa-question">{item.tips || t('qa.noQuestion')}</div>

      <div className={`qa-input-line qa-${qaPhase}`}>
        <span className="qa-prompt">›</span>
        <span className="qa-input-body">{renderInputLine()}</span>
      </div>

      <div className="qa-answer-slot">
        {answerVisible ? (
          <div className={`qa-answer ${qaPhase === 'wrong' ? 'revealed' : 'peek'}`}>
            <span className="qa-answer-label">{t('qa.answer')}</span>
            <AnswerBody item={item} />
          </div>
        ) : (
          <button
            type="button"
            className="qa-peek-btn"
            onMouseDown={(e) => {
              e.preventDefault(); // 保住输入焦点
              peekAnswer(true);
            }}
            onMouseUp={() => peekAnswer(false)}
            onMouseLeave={() => peekAnswer(false)}
            onClick={(e) => e.stopPropagation()}
          >
            {t('qa.peek')}
          </button>
        )}
      </div>

      <div className="qa-hint">{hint}</div>
    </div>
  );
}
