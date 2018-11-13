export default class GlobUtils {
    isDev() {
        return G.NODE_ENV !== 'prod'
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
}