import { useState, useEffect } from 'react';
import { getPlatform, type Platform } from '@/lib/platformDetection';

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>('other');

  useEffect(() => {
    setPlatform(getPlatform());
  }, []);

  return platform;
}
