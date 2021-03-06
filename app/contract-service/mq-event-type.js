/**
 * Created by yuliang on 2017/9/20.
 */

'use strict'

/**
 * 授权服务所发送的所有事件类型
 * @type {{register: {contractExpireEvent: {routingKey: string, eventName: string}}}}
 */
module.exports = {
    /**
     * 需要注册到事件中心的事件
     */
    register: {
        /**
         * 时间到达事件
         */
        arrivalDateEvent: {
            routingKey: 'event.register.arrivalDate',
            eventName: 'registerEvent',
            eventRegisterType: 1,
        },
        /**
         * 取消注册事件
         */
        unRegisterEvent: {
            routingKey: 'event.register.unregister',
            eventName: 'unRegisterEvent'
        },
    },


    /**
     * 授权服务自身的事件
     */
    authService: {

        /**
         * presentable + 1 (合同首次激活)
         */
        presentableContractEffectiveAuthEvent: {
            routingKey: 'contract.active.contract',
            eventName: 'firstActiveContractEvent'
        }
    }
}