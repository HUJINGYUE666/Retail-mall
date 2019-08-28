// pages/orderDetail/orderDetail.js
var ZanToast = require('../../style/zanui/toast/index'); //引入消息提示框控件

var app = getApp();
var isGetAddress = false; //是否成功获取收货地址
var isGetDeliveryTimeType = false; //是否成功获取收货时间
var isGetFreightPlane = false; //是否成功获取运费方案

Page(Object.assign({}, ZanToast, {
  data: {
    isAccount: false, //结算状态，尚未提交订单到后台
    orderStatusTipMap: app.Constants.orderStatusTipMap,
    address: null,
    goodsOrder: {},
    deliveryTimeMap: [],
    deliveryTimeArr: [],
    canOrder: false,
    countDown: '',
    freeFreightAmount: 0
  },

  onLoad(option) {
    var isAccount = option.isAccount;
    var orderUuid = option.uuid;

    wx.setNavigationBarTitle({
      title: isAccount ? '提交订单' : '订单详情'
    });

    this.init(isAccount, orderUuid);
  },
  onShow() {
    if (this.data.isAccount) {
      this.refreshAddress();
    }
  },

  //初始化
  init(isAccount, orderUuid, cb) {
    if (isAccount) {
      //待提交订单
      var goodsOrder = app.globalData.goodsOrder;
      this.setData({
        isAccount: isAccount,
        goodsOrder: goodsOrder
      })
      this.getDeliveryTimeType();
      this.getFreightPlan();
    } else {
      //已提交订单
      this.getOrder(orderUuid, cb);
    }
  },
  //获取订单信息
  getOrder(orderUuid, cb) {
    var that = this;
    var params = app.Http.buildParams()
    params.uuid = orderUuid

    app.Http.request({
      url: 'getOrderBill',
      data: params,
      success(res) {
        if (res.status === 'initial') {
          that.getCountDown(res.createdTime, orderUuid)
        }
        that.setData({
          "goodsOrder": res
        })
        return typeof cb === "function" && cb()
      }
    })
  },
  //刷新地址,如果上次有选择地址，则使用该地址，否则使用默认地址
  refreshAddress() {
    var addressSelected = app.Storage.getStorageSync('address-selected', app.Constants.getCheckFailTip);

    if (!app.Check.isUndeFinedOrNullOrEmpty(addressSelected)) {
      this.setAddress(addressSelected)
    } else {
      this.getDefaultAddress()
    }
  },
  //获取默认地址
  getDefaultAddress() {
    var that = this;
    var params = app.Http.buildParams()

    app.Http.request({
      url: 'getDefaultAddress',
      data: params,
      success(res) {
        that.setAddress(res)
      }
    })
  },
  //设置地址
  setAddress(address) {
    if (address) {
      this.setData({
        "goodsOrder.linkMan": address.linkMan,
        "goodsOrder.linkPhone": address.linkPhone,
        "goodsOrder.address": address.address,
        "goodsOrder.addressUuid": this.data.isAccount ? address.uuid : address.addressUuid,
      })
      isGetAddress = true
    }
  },
  //跳转到地址选择
  jumpToSelectAddress() {
    var thisData = this.data
    if (thisData.isAccount) {
      app.jumpTo('../address/address?status=select&addressUuid=' + thisData.goodsOrder.addressUuid);
    }
  },

  //获取收货时间列表
  getDeliveryTimeType() {
    var that = this;
    var params = app.Http.buildParams()

    app.Http.request({
      url: 'getDeliveryTimeTypeList',
      data: params,
      success(res) {
        var arr = [];
        var obj = {};

        for (var i = 0; i < res.length; i++) {
          var item = res[i];
          var key = item.name + '（' + item.remark + '）';
          arr.push(key)
          obj[key] = item;
          if (i === 0) {
            that.setDeliveryTimeType(item);
          }
        }
        that.setData({
          deliveryTimeArr: arr,
          deliveryTimeMap: obj
        })
        isGetDeliveryTimeType = true;
      }
    })
  },
  //选择收货时间
  selectDeliveryTimeType: function() {
    var that = this;
    var list = that.data.deliveryTimeArr;
    wx.showActionSheet({
      itemList: list,
      success: function(res) {
        if (!res.cancel) {
          var key = list[res.tapIndex];
          var item = that.data.deliveryTimeMap[key];
          that.setDeliveryTimeType(item);
        }
      }
    });
  },
  //设置收货时间
  setDeliveryTimeType(data) {
    this.setData({
      "goodsOrder.deliveryTimeTypeUuid": data.uuid,
      "goodsOrder.deliveryTimeTypeName": data.name,
      "goodsOrder.deliveryTimeTypeRemark": data.remark,
      "goodsOrder.deliveryTimeTypeSurcharge": data.surcharge,
    })
    this.calculatePaymentAmount();
  },
  //获取运费方案
  getFreightPlan() {
    var that = this;
    var params = app.Http.buildParams()

    app.Http.request({
      url: 'getDefaultFreightPlan',
      data: params,
      success(res) {
        if (res) {
          var freight = 0;
          var basicFreight = res.basicFreight; //基础运费
          var freeFreightAmount = res.freeFreightAmount; //免运费金额
          var totalAmount = that.data.goodsOrder.totalAmount; //商品总金额

          that.setData({
            "goodsOrder.freightAmount": totalAmount >= freeFreightAmount ? 0 : basicFreight,
            freeFreightAmount: freeFreightAmount
          })
          that.calculatePaymentAmount();
          isGetFreightPlane = true;
        }
      }
    })
  },
  //填写备注
  handleFiilInRemark(e) {
    this.setData({
      "goodsOrder.remark": e.detail.value
    })
  },
  //计算总金额
  calculatePaymentAmount() {
    var goodsOrder = this.data.goodsOrder;
    var amount1 = app.Count.decimalAdd(goodsOrder.totalAmount, goodsOrder.freightAmount, 6);
    var paymentAmount = app.Count.decimalAdd(amount1, goodsOrder.deliveryTimeTypeSurcharge, 2);

    this.setData({
      "goodsOrder.paymentAmount": paymentAmount
    })
  },
  getCountDown(createdTime, orderUuid) {
    var that = this;
    var interval = setInterval(function() {
      var startTime = new Date(createdTime.replace(/-/g, '/')).getTime()
      var nowTime = new Date().getTime()
      var countDown = app.Format.formatCountDown(nowTime - startTime)

      if (!countDown) {
        clearInterval(interval)
        that.setData({
          'goodsOrder.status': 'canceled'
        })
        // that.getOrder(orderUuid)//刷新订单，后台自动过期
      }
      that.setData({
        countDown: countDown || '0分0秒'
      })
    }, 1000)
  },
  //保存订单
  saveOrder(cb) {
    var that = this;
    var params = app.Http.buildParams()

    //成功获取送货时间和运费方案才能下单
    if (!isGetDeliveryTimeType || !isGetFreightPlane) {
      wx.showModal({
        title: '无法下单',
        confirmColor: '#20a0ff',
        content: !isGetAddress ? app.Constants.selectAddressTip : '商家必须配置送货时间和运费方案才能下单，请联系商家',
        showCancel: false
      })
    } else if (!isGetAddress) {
      this.showZanToast(app.Constants.selectAddressTip);
    } else {
      params.goodsOrder = this.data.goodsOrder;

      app.Http.request({
        url: 'createBill',
        data: params,
        success(res) {
          app.clearCart()
          that.setData({
            'goodsOrder.uuid': res
          })
          return typeof cb === "function" && cb(res)
        }
      })
    }
  },
  //支付
  goPay() {
    var that = this;
    var goodsOrder = that.data.goodsOrder;
    var orderUuid = goodsOrder.uuid;
    var orderVersion = goodsOrder.version;

    if (orderUuid) {
      that.beforePay(orderUuid, orderVersion)
    } else {
      that.saveOrder(function(uuid) {
        that.getOrder(uuid);
        that.beforePay(uuid, orderVersion)
      })
    }
  },
  beforePay(orderUuid, orderVersion) {
    var that = this;
    wx.showModal({
      title: '提示',
      content: '在线支付暂未实现，暂时只支持线下支付',
      confirmText: '线下支付',
      success(res) {
        if (res.confirm) {
          that.auditOrderBill(orderUuid, orderVersion)
        } else if (res.cancel) {
          console.log('用户点击取消')
        }
      }
    })
  },
  //审核订单
  auditOrderBill(uuid, version) {
    var params = app.Http.buildParams()
    params.uuid = uuid
    params.version = version

    app.Http.request({
      url: 'auditBill',
      data: params,
      success(res) {
        wx.showToast({
          title: '订单审核成功',
          icon: 'success',
          duration: 2000
        })
        that.getOrder(uuid);
      }
    })
  },
  //预支付
  toPay(orderUuid) {
    return // to delete

    var that = this;
    var params = app.Http.buildParams()
    params.uuid = orderUuid

    wx.showLoading({
      title: '支付数据提交中',
    })

    app.Http.request({
      url: 'toPay.do',
      data: params,
      success(res) {
        wx.hideLoading()
        //调用微信支付接口
        wx.requestPayment({
          timeStamp: res.timeStamp,
          nonceStr: res.nonceStr,
          package: res.package,
          signType: 'MD5',
          paySign: res.sign,
          success: function(res) {
            wx.showToast({
              title: '支付成功',
              icon: 'success',
              duration: 2000
            })
            //没做websocket，暂时先这样
            wx.redirectTo({
              url: '../orderDetail/orderDetail?uuid=' + orderUuid
            })
          },
          fail: function(res) {

          }
        })
      }
    })
  },
  //再次购买
  orderAgain(e) {
    var orderLines = this.data.goodsOrder.lines;
    app.orderAgain(orderLines);
  },
  //确认收货
  completeOrder(e) {
    var that = this;
    var order = that.data.goodsOrder;
    app.completeOrderBill(order, function() {
      that.getOrder(order.uuid);
    });
  },
  //下拉刷新
  onPullDownRefresh: function() {
    var goodsOrder = this.data.goodsOrder;
    var isAccount = this.data.isAccount;
    var orderUuid = goodsOrder.uuid;
    this.init(isAccount, orderUuid, function() {
      wx.stopPullDownRefresh();
    });
  }
}))