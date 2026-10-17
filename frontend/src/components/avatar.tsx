import * as React from 'react'
import { generateAvatarSvg } from '@/services/identity'

interface AvatarProps {
  pubkey: string
  displayName?: string
  picture?: string
  size?: number
  className?: string
}

export const Avatar: React.FC<AvatarProps> = ({ pubkey, displayName, picture, size = 40, className }) => {
  const src = picture || generateAvatarSvg(pubkey, displayName)

  return (
    <img
      src={src}
      alt={displayName || pubkey.slice(0, 8)}
      width={size}
      height={size}
      className={`rounded-full object-cover shrink-0 ${className || ''}`}
      style={{ width: size, height: size }}
      onError={(e) => {
        // Fallback to generated avatar if external picture fails
        (e.target as HTMLImageElement).src = generateAvatarSvg(pubkey, displayName)
      }}
    />
  )
}
