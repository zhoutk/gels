enum STCODES {
    SUCCESS = 200,              //操作成功
    QUERYEMPTY = 202,           //查无结果
    PRAMAERR = 301,             //输入参数错误
    NOTFOUND = 404,             //获取资源不存在
    JWTAUTHERR = 400,           //授权错误或失效
    PASSWORDERR = 411,          //密码错误
    USERNAMEERR = 412,          //用户名错误或不存在
    AUTHORIZATIONLESS = 413,    //权限不够
    USERNOTFOUND = 414,         //用户不存在
    EXCEPTION = 500,            //发生异常
    DATABASECOERR = 701,        //数据库连接失败
    DATABASEOPERR = 702,        //数据库操作失败
}

export default STCODES