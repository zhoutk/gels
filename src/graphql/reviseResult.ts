import BaseDao from '../db/baseDao'

const customDefs = `
    type ReviseResult {
        id: Int
        affectedRows: Int
        status: Int
        message: String
    }

    type Post {
        id: Int!
        title: String
    }

`

let queryDefs = ['posts: [Post]']

const customResolvers = {
    Query: {
        posts: async () => {
            let rs = await new BaseDao('book').retrieve({})
            return rs.data
        }
    }
}

export { customDefs, queryDefs, customResolvers }