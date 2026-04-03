// Simple in-memory rate limiter to avoid redis-dependent packages
const records = new Map<string, { count: number; reset: number }>()

import { config, jsResponse } from '../inits/global'
import { STCODES } from '../inits/enums'

export default () => {
    const duration = Number(config?.rateLimit?.duration) || 60 * 1000
    const max = Number(config?.rateLimit?.max) || 100

    // periodic cleanup to prevent memory leak
    setInterval(() => {
        const now = Date.now()
        for (const [k, v] of records.entries()) {
            if (v.reset <= now) records.delete(k)
        }
    }, Math.max(60000, duration))

    return async (ctx: any, next: any) => {
        const id = (ctx && (ctx.ip || ctx.request?.ip)) || ctx.hostname || ctx.path || 'global'
        const now = Date.now()
        let rec = records.get(id)
        if (!rec || rec.reset <= now) {
            rec = { count: 1, reset: now + duration }
            records.set(id, rec)
        } else {
            rec.count += 1
            records.set(id, rec)
            if (rec.count > max) {
                ctx.status = 429
                ctx.body = jsResponse(STCODES.EXCEPTIONERR, 'Too many requests, please try again later.')
                return
            }
        }

        await next()
    }
}