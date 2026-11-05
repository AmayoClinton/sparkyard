import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown } from '../src/components/markdown'

describe('markdown renderer', () => {
  it('renders headings', () => {
    const html = renderToStaticMarkup(<Markdown children="# Hello" />)
    expect(html).toContain('<h1')
    expect(html).toContain('Hello')
  })

  it('renders bold and italic', () => {
    const html = renderToStaticMarkup(<Markdown children="**bold** and *italic*" />)
    expect(html).toContain('<b')
    expect(html).toContain('bold')
    expect(html).toContain('<i')
    expect(html).toContain('italic')
  })

  it('renders inline code and code blocks', () => {
    const html = renderToStaticMarkup(<Markdown children="use `const x = 1`" />)
    expect(html).toContain('<code')
    expect(html).toContain('const x = 1')
    const block = renderToStaticMarkup(<Markdown children="```ts\nconst x = 1\n```" />)
    expect(block).toContain('<pre')
    expect(block).toContain('const x = 1')
  })

  it('renders links', () => {
    const html = renderToStaticMarkup(<Markdown children="[nostr](https://nostr.com)" />)
    expect(html).toContain('href="https://nostr.com"')
    expect(html).toContain('nostr')
  })

  it('renders lists and blockquotes', () => {
    const list = renderToStaticMarkup(<Markdown children="- one\n- two" />)
    expect(list).toContain('<li')
    expect(list).toContain('one')
    expect(list).toContain('two')
    const quote = renderToStaticMarkup(<Markdown children="> quoted" />)
    expect(quote).toContain('<blockquote')
    expect(quote).toContain('quoted')
  })

  it('renders empty content as empty div', () => {
    expect(renderToStaticMarkup(<Markdown />)).toEqual('<div></div>')
  })
})
