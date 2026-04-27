import React from 'react';
import tiktokIcon from '../../../imports/tok_tik_brands_icon_256563.png';
import facebookIcon from '../../../imports/5293-facebook_102565.png';
import instagramIcon from '../../../imports/ig_instagram_media_social_icon_124260.png';
import snapchatIcon from '../../../imports/Snapchat_icon-icons.com_66800.png';
import googleIcon from '../../../imports/googlechrome_93595.png';
import zidIcon from '../../../imports/zid_platform.png';
import sallaIcon from '../../../imports/salla_platform.png';

export const PLATFORM_ICONS: Record<string, string> = {
  tiktok: tiktokIcon,
  facebook: facebookIcon,
  instagram: instagramIcon,
  snapchat: snapchatIcon,
  google: googleIcon,
  zid: zidIcon,
  Zid: zidIcon,
  salla: sallaIcon,
  Salla: sallaIcon,
};

export function PlatformIcon({
  id, size = 20, className = '', alt,
}: { id: string; size?: number; className?: string; alt?: string }) {
  const key = id || '';
  const src = PLATFORM_ICONS[key] || PLATFORM_ICONS[key.toLowerCase()];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt || id}
      className={`inline-block object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
