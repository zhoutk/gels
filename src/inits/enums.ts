enum STCODES {
    SUCCESS = 200,              //操作成功
    QUERYEMPTY = 202,           //查无结果
    PRAMAERR = 301,             //输入参数错误
    NOTFOUND = 404,             //获取资源不存在
    UPLOADERR = 415,            //文件上传失败
    JWTAUTHERR = 400,           //授权错误或失效
    PASSWORDERR = 411,          //密码错误
    USERNAMEERR = 412,          //用户名错误或不存在
    AUTHORIZATIONLESS = 413,    //权限不够
    USERNOTFOUND = 414,         //用户不存在
    EXCEPTION = 500,            //发生异常
    DATABASECOERR = 701,        //数据库连接失败
    DATABASEOPERR = 702,        //数据库操作失败
    DATABASENEEDRESTART = 703,  //数据库表修改，需要服务重启
    DATABASENEEDID = 704,       //数据库表必须包含ID字段
    TASKALREADYRESEND = 801,    //任务已经二次分派过了
    PARENTNOTFOUND = 802,       //父记录不存在
    TASKALREADYCOMMIT = 803,    //任务已经提交过
    TASKDONOTCOMMIT = 804,      //任务还未提交
    TASKALREADYRESPOND = 805,   //席位任务已经响应
    REPORTALREADYCOMMIT = 807,  //提报已经提交过
}

export default STCODES