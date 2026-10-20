import * as React from 'react'

interface MarkdownProps {
  children?: string
  className?: string
}

function inline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let pending = ''
  const emit = () => {
    if (pending) {
      nodes.push(pending)
      pending = ''
    }
  }
  let i = 0
  while (i < text.length) {
    if (text[i] === '\n') {
      emit()
      nodes.push(<br key={nodes.length} />)
      i++
      continue
    }
    if (text[i] === '`') {
      const j = text.indexOf('`', i + 1)
      if (j === -1) {
        pending += text[i]
        i++
        continue
      }
      emit()
      nodes.push(
        <code key={nodes.length} className="bg-muted px-1 py-0.5 rounded text-xs">
          {text.slice(i + 1, j)}
        </code>
      )
      i = j + 1
      continue
    }
    if (text.slice(i, i + 2) === '**') {
      const j = text.indexOf('**', i + 2)
      if (j === -1) {
        pending += '**'
        i += 2
        continue
      }
      emit()
      nodes.push(
        <b key={nodes.length} className="font-bold">
          {inline(text.slice(i + 2, j))}
        </b>
      )
      i = j + 2
      continue
    }
    if (text[i] === '*') {
      const j = text.indexOf('*', i + 1)
      if (j === -1 || j === i + 1) {
        pending += '*'
        i++
        continue
      }
      emit()
      nodes.push(
        <i key={nodes.length} className="italic">
          {text.slice(i + 1, j)}
        </i>
      )
      i = j + 1
      continue
    }
    const link = /^\[([^\]]*)\]\(([^)]*)\)/.exec(text.slice(i))
    if (link) {
      emit()
      nodes.push(
        <a
          key={nodes.length}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-4"
        >
          {inline(link[1])}
        </a>
      )
      i += link[0].length
      continue
    }
    pending += text[i]
    i++
  }
  emit()
  return nodes
}

export function Markdown({ children: raw = '', className }: MarkdownProps): React.ReactNode {
  const lines = raw.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i])
        i++
      }
      i++
      blocks.push(
        <pre key={blocks.length} className="bg-muted p-3 rounded-md text-sm font-mono overflow-x-auto border border-border">
          <code className={`language-${lang} text-foreground`}>{code.join('\n')}</code>
        </pre>
      )
      continue
    }

    const heading = /^(#{1,6})\s+(.*)/.exec(line)
    if (heading) {
      const level = heading[1].length
      const Tag = ('h' + level) as React.ElementType
      blocks.push(<Tag key={blocks.length} className="font-bold text-foreground mt-5 mb-1">{inline(heading[2])}</Tag>)
      i++
      continue
    }

    if (line.startsWith('> ')) {
      const quote: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quote.push(lines[i].slice(2))
        i++
      }
      blocks.push(
        <blockquote key={blocks.length} className="border-l-2 border-accent pl-3 italic text-muted-foreground my-3">
          {inline(quote.join(' '))}
        </blockquote>
      )
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={blocks.length} className="list-disc pl-5 my-3 space-y-1 text-foreground">
          {items.map((text, idx) => (
            <li key={idx}>{inline(text)}</li>
          ))}
        </ul>
      )
      continue
    }

    if (line.trim() !== '') {
      const paras: string[] = []
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].startsWith('```') &&
        !/^(#{1,6})\s/.test(lines[i]) &&
        !lines[i].startsWith('> ') &&
        !/^\s*[-*]\s+/.test(lines[i])
      ) {
        paras.push(lines[i])
        i++
      }
      blocks.push(
        <p key={blocks.length} className="my-3 text-foreground leading-relaxed">
          {paras.map((text, idx) => (
            <React.Fragment key={idx}>
              {inline(text)}
              {idx < paras.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      )
      continue
    }

    i++
  }

  return <div className={className}>{blocks}</div>
}
