import { useEffect, useState } from 'react'

/**
 * useCounterAnimation - Animates a number from 0 to target over ~600ms
 * 
 * @param {number} target - Target value to count up to
 * @returns {number} Current animated value
 */
export function useCounterAnimation(target) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (typeof target !== 'number') {
      setCurrent(0)
      return
    }

    const duration = 600 // ms
    const startTime = Date.now()
    const startValue = 0

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = startValue + (target - startValue) * eased

      setCurrent(value)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setCurrent(target)
      }
    }

    requestAnimationFrame(animate)
  }, [target])

  return current
}
