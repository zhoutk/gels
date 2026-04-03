import assert from 'node:assert/strict'
import request from 'supertest'
import { afterAll, beforeAll, describe, it } from 'vitest'
import appIniter from '../dist/app.js'
import BaseDao from '../dist/db/baseDao.js'
import { config, globInit } from '../dist/inits/global.js'

describe.sequential('rest api integration', () => {
    let app: Awaited<ReturnType<typeof appIniter.init>> | undefined
    let tableName = 'table_for_test'

    const rs = () => {
        if (!app) {
            throw new Error('app is not initialized')
        }
        return request(app.callback())
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

    it('returns a seeded row by id', async () => {
        const response = await rs()
            .get(`/rs/${tableName}/a1b2c3d4`)
            .expect(200)

        const dataZero = response.body.data[0]
        assert.equal(response.body.status, 200)
        assert.equal(dataZero.name, 'Kevin 凯文')
        assert.equal(dataZero.age, 18)
        assert.equal(Number(dataZero.score), 99.99)
    })

    it('supports id and field filtering', async () => {
        const response = await rs()
            .get(`/rs/${tableName}`)
            .query({ id: 'a1b2c3d4', age: 18 })
            .expect(200)

        const dataZero = response.body.data[0]
        assert.equal(response.body.status, 200)
        assert.equal(Number(dataZero.score), 99.99)
    })

    it('rejects an exact match when the value differs', async () => {
        const response = await rs()
            .get(`/rs/${tableName}`)
            .query({ id: 'a1b2c3d4', age: 18, name: 'Kevin' })
            .expect(200)

        assert.equal(response.body.status, 202)
    })

    it('finds an exact match when the value is correct', async () => {
        const response = await rs()
            .get(`/rs/${tableName}`)
            .query({ id: 'a1b2c3d4', age: 18, name: 'Kevin 凯文' })
            .expect(200)

        assert.equal(response.body.status, 200)
        assert.equal(response.body.data[0].name, 'Kevin 凯文')
    })

    it('supports fuzzy search', async () => {
        const response = await rs()
            .get(`/rs/${tableName}`)
            .query({ name: 'Kevin', fuzzy: 1 })
            .expect(200)

        assert.equal(response.body.status, 200)
        assert.equal(response.body.data[0].name, 'Kevin 凯文')
    })

    it('updates a row', async () => {
        const response = await rs()
            .put(`/rs/${tableName}`)
            .send({
                id: 'a1b2c3d4',
                score: 6.6,
            })
            .expect(200)

        assert.equal(response.body.status, 200)
    })

    it('reflects the updated value', async () => {
        const response = await rs()
            .get(`/rs/${tableName}/a1b2c3d4`)
            .expect(200)

        assert.equal(response.body.status, 200)
        assert.equal(Number(response.body.data[0].score), 6.6)
    })

    it('deletes a row', async () => {
        const response = await rs()
            .delete(`/rs/${tableName}`)
            .query({ id: 'a1b2c3d4' })
            .expect(200)

        assert.equal(response.body.status, 200)
    })

    it('returns empty after deletion', async () => {
        const response = await rs()
            .get(`/rs/${tableName}/a1b2c3d4`)
            .expect(200)

        assert.equal(response.body.status, 202)
    })

    it('supports fuzzy search over multiple rows', async () => {
        const response = await rs()
            .get(`/rs/${tableName}`)
            .query({ name: 'test', fuzzy: 1 })
            .expect(200)

        assert.equal(response.body.status, 200)
        assert.equal(response.body.data.length, 5)
    })

    it('updates multiple fields', async () => {
        const response = await rs()
            .put(`/rs/${tableName}`)
            .send({
                id: 'a5b6c7d8',
                name: 'test888',
                score: 23.27,
                age: 22,
            })
            .expect(200)

        assert.equal(response.body.status, 200)
    })

    it('retrieves the updated row by id', async () => {
        const response = await rs()
            .get(`/rs/${tableName}`)
            .query({ id: 'a5b6c7d8' })
            .expect(200)

        const dataZero = response.body.data[0]
        assert.equal(response.body.status, 200)
        assert.equal(dataZero.name, 'test888')
        assert.equal(Number(dataZero.score), 23.27)
        assert.equal(dataZero.age, 22)
    })

    it('supports ins queries', async () => {
        const response = await rs()
            .get(`/rs/${tableName}`)
            .query({ ins: 'age,20,21,23' })
            .expect(200)

        assert.equal(response.body.status, 200)
        assert.equal(response.body.data.length, 3)
    })

    it('supports lks queries', async () => {
        const response = await rs()
            .get(`/rs/${tableName}`)
            .query({ lks: 'name,001,age,23' })
            .expect(200)

        assert.equal(response.body.status, 200)
        assert.equal(response.body.data.length, 2)
    })

    it('supports ors queries', async () => {
        const response = await rs()
            .get(`/rs/${tableName}`)
            .query({ ors: 'age,19,age,23' })
            .expect(200)

        assert.equal(response.body.status, 200)
        assert.equal(response.body.data.length, 2)
    })

    it('supports pagination', async () => {
        const response = await rs()
            .get(`/rs/${tableName}`)
            .query({ page: 1, size: 3 })
            .expect(200)

        assert.equal(response.body.status, 200)
        assert.equal(response.body.data.length, 3)
    })

    it('supports count queries', async () => {
        const response = await rs()
            .get(`/rs/${tableName}`)
            .query({ count: '1,total' })
            .expect(200)

        const dataZero = response.body.data[0]
        assert.equal(response.body.status, 200)
        assert.equal(Number(dataZero.total), 5)
    })

    it('supports sum queries', async () => {
        const response = await rs()
            .get(`/rs/${tableName}`)
            .query({ sum: 'age,agesum', age: '<=,20' })
            .expect(200)

        const dataZero = response.body.data[0]
        assert.equal(response.body.status, 200)
        assert.equal(Number(dataZero.agesum), 39)
    })

    it('supports group queries', async () => {
        const updateResponse = await rs()
            .put(`/rs/${tableName}`)
            .send({
                id: 'a4b5c6d7',
                age: 22,
            })
            .expect(200)

        assert.equal(updateResponse.body.status, 200)

        const response = await rs()
            .get(`/rs/${tableName}`)
            .query({ group: 'age', count: '*,total', sort: 'total desc' })
            .expect(200)

        const dataZero = response.body.data[0]
        assert.equal(response.body.status, 200)
        assert.equal(Number(dataZero.total), 2)
    })

    it('supports greater than and less than operators', async () => {
        let response = await rs()
            .get(`/rs/${tableName}`)
            .query({ age: '>,21' })
            .expect(200)

        assert.equal(response.body.status, 200)
        assert.equal(response.body.data.length, 3)

        response = await rs()
            .get(`/rs/${tableName}`)
            .query({ age: '>=,19,<=,22' })
            .expect(200)

        assert.equal(response.body.status, 200)
        assert.equal(response.body.data.length, 4)
    })

    it('creates and removes a new row', async () => {
        const createdId = `tmp_${Date.now().toString(16)}`

        const createResponse = await rs()
            .post(`/rs/${tableName}`)
            .send({
                id: createdId,
                name: 'temp row',
                age: 24,
                score: 11.11,
            })
            .expect(200)

        assert.equal(createResponse.body.status, 200)
        assert.equal(createResponse.body.id, createdId)

        const readResponse = await rs()
            .get(`/rs/${tableName}/${createdId}`)
            .expect(200)

        assert.equal(readResponse.body.status, 200)
        assert.equal(readResponse.body.data[0].name, 'temp row')

        const deleteResponse = await rs()
            .delete(`/rs/${tableName}`)
            .query({ id: createdId })
            .expect(200)

        assert.equal(deleteResponse.body.status, 200)
    })
})