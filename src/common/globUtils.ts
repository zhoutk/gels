export default class GlobUtils {
    isDev() {
        return global.NODE_ENV !== 'prod'
    }
    isLogin() {
        return true
    }
    arryParse(arr) {
        try {
            if (Array.isArray(arr))
                return arr
            else if (typeof arr === 'string' && arr.startsWith('['))
                arr = JSON.parse(arr)
            else 
                return null
        } catch (err) {
            arr = null
        }
        return arr
    }
    promisify(func) {
        return new Promise((resolve) => {
            func(resolve)
        })
    }
}