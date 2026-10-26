import * as React from 'react'
import { type Widget } from '@/services/widgets'
import { widgetFrameProps } from '@/services/widgets'

export const WidgetFrame: React.FC<{ widget: Widget }> = ({ widget }) => {
  const props = widgetFrameProps(widget)
  return (
    <iframe
      {...props}
      title={widget.title}
      className="w-full h-64 rounded-lg border border-border bg-card"
    />
  )
}