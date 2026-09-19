import { fetchMatch } from './engine/matchApi.ts'
import { JUDGE_POLL_MS, judgeThread, type JudgeBlock, type JudgeLetter } from './engine/judgeTheater.ts'
import type { MatchRecord } from './engine/match.ts'

let lastJson = ''

function tick(): void {
  void pull()
}

async function pull(): Promise<void> {
  try {
    const record = await fetchMatch()
    const raw = JSON.stringify(record)
    // 團檔字串沒變則不重畫。collecting 要重畫剩餘秒。
    if (raw === lastJson && record.status !== 'collecting') return
    lastJson = raw
    paint(judgeThread(record))
    syncHeader(record)
  } catch {
    return
  }
}

function paint(blocks: JudgeBlock[]): void {
  const thread = document.querySelector('.thread')
  if (!(thread instanceof HTMLElement)) return
  thread.replaceChildren(...blocks.map((block) => nodeOf(block)))
  thread.scrollTop = thread.scrollHeight
}

function nodeOf(block: JudgeBlock): HTMLElement {
  switch (block.kind) {
    case 'day':
      return el('div', 'day', block.text)
    case 'sys': {
      const wrap = el('div', 'sys')
      wrap.append(el('span', undefined, block.text))
      return wrap
    }
    case 'mind': {
      const section = el('section', 'mind')
      const head = el('p', 'mind-head')
      head.append(el('span', 'mind-mark', '\u25C6'), document.createTextNode(` ${block.title}`))
      section.append(head, ...block.lines.map((line) => el('p', undefined, line)))
      return section
    }
    case 'pitch':
    case 'score':
      return rowOf(block.letter, block.label, block.lines)
    default: {
      const _exhaustive: never = block
      return _exhaustive
    }
  }
}

function rowOf(letter: JudgeLetter, label: string, lines: string[]): HTMLElement {
  const row = el('div', 'row')
  const avatar = el('div', `avatar ${letter.toLowerCase()}`, letter)
  const col = el('div', 'col')
  const bubble = el('div', 'bubble')
  bubble.append(...lines.map((line) => el('p', undefined, line)))
  col.append(el('p', 'name', label), bubble)
  row.append(avatar, col)
  return row
}

function syncHeader(record: MatchRecord): void {
  const line = document.querySelector('header p')
  if (!(line instanceof HTMLElement)) return
  switch (record.status) {
    case 'collecting': {
      const n = record.joins.length
      line.textContent =
        n === 0 ? 'Waiting for riders · 1 arbiter mind' : `${agentCountCopy(n)} waiting · 1 arbiter mind`
      return
    }
    case 'settled':
    case 'solo':
      line.textContent = `${agentCountCopy(record.riders.length)} pitch · 1 arbiter mind`
      return
    default: {
      const _exhaustive: never = record.status
      return _exhaustive
    }
  }
}

function agentCountCopy(n: number): string {
  return n === 1 ? '1 user agent' : `${n} user agents`
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

void pull()
window.setInterval(tick, JUDGE_POLL_MS)
