import assert from 'node:assert/strict'
import request from 'supertest'
import { afterAll, beforeAll, describe } from 'vitest'
import appIniter from '../dist/app.js'
import BaseDao from '../dist/db/baseDao.js'
import { config, globInit } from '../dist/inits/global.js'
import { defineRestContractSuite } from './support/rsContract'

describe.sequential('rest api integration', () => {
    let app: Awaited<ReturnType<typeof appIniter.init>> | undefined
    let tableName = 'table_for_test'

    const rs = () => {
        if (!app) {
            throw new Error('app is not initialized')
        }
        return request(app.callback())
    }

    const cleanupRows = async (ids: string[]) => {
        for (const id of ids) {
            await rs()
                .delete(`/rs/${tableName}`)
                .query({ id })
                .expect(200)
        }
    }

    beforeAll(async () => {
        globInit()
        config.skipRestAuth = true
        config.rateLimit.max = 1000
        app = await appIniter.init()

        const response = await rs()
            .post('/rs/db_init')
            .send({ tableName: 'table_for_test' })
            .expect(200)

        tableName = response.body.table || tableName
        assert.equal(response.body.status, 200)
        assert.equal(response.body.table, tableName)
    })

    afterAll(async () => {
        if (app) {
            if (!process.env.KEEP_TEST_DB) {
                await rs()
                    .delete('/rs/db_init')
                    .query({ tableName })
                    .expect(200)
            }
        }
        await BaseDao.closeDao()
    })

    defineRestContractSuite({
        tableName: () => tableName,
        request: rs,
        dao: () => new BaseDao(tableName),
        cleanupRows,
        seededRowId: 'a1b2c3d4',
        manualRowId: 'manual001',
    })
})