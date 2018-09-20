export default {
    isDev() {
        return global.NODE_ENV !== 'prod'
    }
}