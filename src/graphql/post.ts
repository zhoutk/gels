import BaseDao from '../db/baseDao'

const customDefs = `
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