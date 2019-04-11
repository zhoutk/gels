import BaseDao from '../db/baseDao'

const customDefs = {
    textDefs: `
        type Post {
            id: Int!
            title: String
            author: Author
        }
    `,
    queryDefs: ['posts: [Post]'],
    mutationDefs: ['addPost(title: String!, author_id: Int!): ReviseResult']
}

const customResolvers = {
    Query: {
        posts: async () => {
            let rs = await new BaseDao('book').retrieve({})
            return rs.data
        }
    },
    Mutation: {
        addPost: (_, args) => {
            return new BaseDao('book').create(args)
        }
    },
    Post: {
        author: async (element) => {
            let rs = await new BaseDao('author').retrieve({ id: element.author_id })
            return rs.data[0]
        }
    }
}

export { customDefs, customResolvers }