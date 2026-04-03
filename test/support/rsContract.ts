import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

interface RestContractContext {
    tableName: () => string
    request: () => any
    dao: () => any
    cleanupRows: (ids: string[]) => Promise<void>
    seededRowId?: string
    manualRowId?: string
}

function rowUrl(tableName: string, id?: string) {
    return id ? `/rs/${tableName}/${id}` : `/rs/${tableName}`
}

async function fetchRow(requestFactory: () => any, tableName: string, id: string) {
    const response = await requestFactory()
        .get(rowUrl(tableName, id))
        .expect(200)

    return response.body.data?.[0] ?? null
}

async function createRow(requestFactory: () => any, tableName: string, body: Record<string, unknown>) {
    return requestFactory()
        .post(rowUrl(tableName))
        .send(body)
        .expect(200)
}

export function defineRestContractSuite(context: RestContractContext) {
    const seededRowId = context.seededRowId ?? 'a1b2c3d4'
    const manualRowId = context.manualRowId ?? 'manual001'
    const requestFactory = context.request
    const daoFactory = context.dao
    const getTableName = context.tableName

    describe('read contract', () => {
        it('returns a seeded row by id', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName(), seededRowId))
                .expect(200)

            const dataZero = response.body.data[0]
            assert.equal(response.body.status, 200)
            assert.equal(dataZero.name, 'Kevin 凯文')
            assert.equal(dataZero.age, 18)
            assert.equal(Number(dataZero.score), 99.99)
        })

        it('supports id and field filtering', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ id: seededRowId, age: 18 })
                .expect(200)

            const dataZero = response.body.data[0]
            assert.equal(response.body.status, 200)
            assert.equal(Number(dataZero.score), 99.99)
        })

        it('rejects an exact match when the value differs', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ id: seededRowId, age: 18, name: 'Kevin' })
                .expect(200)

            assert.equal(response.body.status, 202)
        })

        it('finds an exact match when the value is correct', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ id: seededRowId, age: 18, name: 'Kevin 凯文' })
                .expect(200)

            assert.equal(response.body.status, 200)
            assert.equal(response.body.data[0].name, 'Kevin 凯文')
        })

        it('returns only requested fields when fields is provided', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ id: 'a2b3c4d5', fields: JSON.stringify(['name', 'score']) })
                .expect(200)

            const dataZero = response.body.data[0]
            assert.equal(response.body.status, 200)
            assert.equal(dataZero.name, 'test001')
            assert.equal(Number(dataZero.score), 98.88)
            assert.equal(dataZero.id, undefined)
            assert.equal(dataZero.age, undefined)
        })

        it('rejects invalid fields definitions', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ fields: '[1,2]' })
                .expect(200)

            assert.equal(response.body.status, 301)
        })

        it('supports fuzzy search', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ name: 'Kevin', fuzzy: 1 })
                .expect(200)

            assert.equal(response.body.status, 200)
            assert.equal(response.body.data[0].name, 'Kevin 凯文')
        })
    })

    describe('write contract', () => {
        it('updates a row and persists the value', async () => {
            const response = await requestFactory()
                .put(rowUrl(getTableName()))
                .send({
                    id: seededRowId,
                    score: 6.6,
                })
                .expect(200)

            assert.equal(response.body.status, 200)

            const row = await fetchRow(requestFactory, getTableName(), seededRowId)
            assert.equal(Number(row.score), 6.6)
        })

        it('deletes a row', async () => {
            const response = await requestFactory()
                .delete(rowUrl(getTableName()))
                .query({ id: seededRowId })
                .expect(200)

            assert.equal(response.body.status, 200)
        })

        it('returns empty after deletion', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName(), seededRowId))
                .expect(200)

            assert.equal(response.body.status, 202)
        })

        it('updates multiple fields and persists them', async () => {
            const response = await requestFactory()
                .put(rowUrl(getTableName()))
                .send({
                    id: 'a5b6c7d8',
                    name: 'test888',
                    score: 23.27,
                    age: 22,
                })
                .expect(200)

            assert.equal(response.body.status, 200)

            const row = await fetchRow(requestFactory, getTableName(), 'a5b6c7d8')
            assert.equal(row.name, 'test888')
            assert.equal(Number(row.score), 23.27)
            assert.equal(row.age, 22)
        })

        it('creates a row with partial fields and auto-generates an id', async () => {
            const createResponse = await createRow(requestFactory, getTableName(), {
                name: 'zhoutk',
            })

            const createdId = createResponse.body.id
            assert.equal(createResponse.body.status, 200)
            assert.equal(typeof createdId, 'string')
            assert.match(createdId, /^[0-9a-f]{8}$/i)

            const row = await fetchRow(requestFactory, getTableName(), createdId)
            assert.equal(row.name, 'zhoutk')
            assert.equal(row.age, null)
            assert.equal(row.score, null)
            assert.equal(row.id, createdId)

            await context.cleanupRows([createdId])
        })

        it('creates a row with a provided id and partial fields', async () => {
            const createResponse = await createRow(requestFactory, getTableName(), {
                id: manualRowId,
                name: 'manual-row',
            })

            assert.equal(createResponse.body.status, 200)
            assert.equal(createResponse.body.id, manualRowId)

            const row = await fetchRow(requestFactory, getTableName(), manualRowId)
            assert.equal(row.name, 'manual-row')
            assert.equal(row.age, null)
            assert.equal(row.score, null)

            await context.cleanupRows([manualRowId])
        })

        it('rejects create with empty payload', async () => {
            const response = await requestFactory()
                .post(rowUrl(getTableName()))
                .send({})
                .expect(200)

            assert.equal(response.body.status, 301)
        })

        it('rejects update without id', async () => {
            const response = await requestFactory()
                .put(rowUrl(getTableName()))
                .send({ score: 1 })
                .expect(200)

            assert.equal(response.body.status, 301)
        })

        it('rejects delete without id', async () => {
            const response = await requestFactory()
                .delete(rowUrl(getTableName()))
                .query({})
                .expect(200)

            assert.equal(response.body.status, 301)
        })
    })

    describe('query contract', () => {
        it('supports fuzzy search over multiple rows', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ name: 'test', fuzzy: 1 })
                .expect(200)

            assert.equal(response.body.status, 200)
            assert.equal(response.body.data.length, 5)
        })

        it('supports ins queries', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ ins: 'age,20,21,23' })
                .expect(200)

            assert.equal(response.body.status, 200)
            assert.equal(response.body.data.length, 3)
        })

        it('supports lks queries', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ lks: 'name,001,age,23' })
                .expect(200)

            assert.equal(response.body.status, 200)
            assert.equal(response.body.data.length, 2)
        })

        it('supports ors queries', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ ors: 'age,19,age,23' })
                .expect(200)

            assert.equal(response.body.status, 200)
            assert.equal(response.body.data.length, 2)
        })

        it('supports pagination', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ page: 1, size: 3 })
                .expect(200)

            assert.equal(response.body.status, 200)
            assert.equal(response.body.data.length, 3)
        })

        it('supports count queries', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ count: '1,total' })
                .expect(200)

            const dataZero = response.body.data[0]
            assert.equal(response.body.status, 200)
            assert.equal(Number(dataZero.total), 5)
        })

        it('supports sum queries', async () => {
            const response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ sum: 'age,agesum', age: '<=,20' })
                .expect(200)

            const dataZero = response.body.data[0]
            assert.equal(response.body.status, 200)
            assert.equal(Number(dataZero.agesum), 39)
        })

        it('supports group queries', async () => {
            const updateResponse = await requestFactory()
                .put(rowUrl(getTableName()))
                .send({
                    id: 'a4b5c6d7',
                    age: 22,
                })
                .expect(200)

            assert.equal(updateResponse.body.status, 200)

            const response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ group: 'age', count: '*,total', sort: 'total desc' })
                .expect(200)

            const dataZero = response.body.data[0]
            assert.equal(response.body.status, 200)
            assert.equal(Number(dataZero.total), 2)
        })

        it('supports greater than and less than operators', async () => {
            let response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ age: '>,21' })
                .expect(200)

            assert.equal(response.body.status, 200)
            assert.equal(response.body.data.length, 3)

            response = await requestFactory()
                .get(rowUrl(getTableName()))
                .query({ age: '>=,19,<=,22' })
                .expect(200)

            assert.equal(response.body.status, 200)
            assert.equal(response.body.data.length, 4)
        })
    })

    describe('dao contract', () => {
        it('executes raw sql and persists the change', async () => {
            const tempId = 'sql001'
            await createRow(requestFactory, getTableName(), {
                id: tempId,
                name: 'sql-row',
                age: 31,
                score: 11.11,
            })

            const dao = daoFactory()
            const updateResult = await dao.execSql('UPDATE ?? SET score = ? WHERE id = ?', [getTableName(), 77.77, tempId])

            assert.equal(updateResult.status, 200)
            const row = await fetchRow(requestFactory, getTableName(), tempId)
            assert.equal(Number(row.score), 77.77)

            await context.cleanupRows([tempId])
        })

        it('inserts batch rows through the DAO helper', async () => {
            const rows = [
                { id: 'batch001', name: 'batch-one', age: 40, score: 1.11 },
                { id: 'batch002', name: 'batch-two', age: 41, score: 2.22 },
            ]

            const dao = daoFactory()
            const batchResult = await dao.insertBatch(getTableName(), rows)

            assert.equal(batchResult.status, 200)
            const first = await fetchRow(requestFactory, getTableName(), 'batch001')
            const second = await fetchRow(requestFactory, getTableName(), 'batch002')
            assert.equal(first.name, 'batch-one')
            assert.equal(Number(first.score), 1.11)
            assert.equal(second.name, 'batch-two')
            assert.equal(Number(second.score), 2.22)

            await context.cleanupRows(rows.map((row) => row.id))
        })

        it('commits async transactions through the DAO helper', async () => {
            const rows = [
                { id: 'txa001', name: 'tx-a-one', age: 50, score: 5.01 },
                { id: 'txa002', name: 'tx-a-two', age: 51, score: 5.02 },
            ]

            const dao = daoFactory()
            const transResult = await dao.transGo([
                { table: getTableName(), method: 'Insert', params: rows[0] },
                { table: getTableName(), method: 'Insert', params: rows[1] },
            ], true)

            assert.equal(transResult.status, 200)
            const first = await fetchRow(requestFactory, getTableName(), rows[0].id)
            const second = await fetchRow(requestFactory, getTableName(), rows[1].id)
            assert.equal(first.name, 'tx-a-one')
            assert.equal(second.name, 'tx-a-two')

            await context.cleanupRows(rows.map((row) => row.id))
        })

        it('commits sync transactions through the DAO helper', async () => {
            const rows = [
                { id: 'txs001', name: 'tx-s-one', age: 60, score: 6.01 },
                { id: 'txs002', name: 'tx-s-two', age: 61, score: 6.02 },
            ]

            const dao = daoFactory()
            const transResult = await dao.transGo([
                { table: getTableName(), method: 'Insert', params: rows[0] },
                { table: getTableName(), method: 'Insert', params: rows[1] },
            ], false)

            assert.equal(transResult.status, 200)
            const first = await fetchRow(requestFactory, getTableName(), rows[0].id)
            const second = await fetchRow(requestFactory, getTableName(), rows[1].id)
            assert.equal(first.name, 'tx-s-one')
            assert.equal(second.name, 'tx-s-two')

            await context.cleanupRows(rows.map((row) => row.id))
        })
    })
}
