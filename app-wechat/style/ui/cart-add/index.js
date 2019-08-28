var ZanQuantity = require('../../zanui/quantity/index')//引入数字输入控件
var ZanToast = require('../../zanui/toast/index');//引入消息提示框控件

var app = getApp();//获取应用实例

var cartAdd = Object.assign({}, ZanQuantity, ZanToast, {
  //添加到购物车
  addToCart(e) {
    var dataset = e.currentTarget.dataset || {};
    var cartData = dataset.cartData || {}; console.log(cartData); console.log(cartData.goods);
    var key = cartData.goods && cartData.goods.goods ? cartData.goods.goods.uuid : '';
    var cartStorage = app.Storage.getStorageSync('cart', app.Constants.getCartFailTip) || {};
    var cartCheckStorage = app.Storage.getStorageSync('cart-check', app.Constants.getCheckFailTip) || {};
    var cartItem = this.getCartItem(cartData);

    if (key) {
      this.setData({
        "cartData.showDialog": false
      });
      
      cartStorage[key] = cartItem;
      cartCheckStorage[key] = true;
      app.Storage.setStorageSync('cart', cartStorage, app.Constants.addToCartFailTip)
      app.Storage.setStorageSync('cart-check', cartCheckStorage, app.Constants.saveCheckFailTip)
      this.setData({
        isCartEmpty: false
      });
      this.showZanToast('已成功添加到购物车');
    } else {
      this.showZanToast('无法添加到购物车');
    }
  },
  //通过cartData构建一条购物车数据
  getCartItem(data) {
    var result = {};
    var goodsInfo = data.goods;

    result.goods = goodsInfo.goods;
    result.unitName = goodsInfo.unitName;
    result.goodsPic = goodsInfo.thumbnail;
    result.goodsSpec = goodsInfo.goodsSpec;
    result.goodsCategoryUuid = goodsInfo.categoryUuid;
    result.goodsCategoryName = goodsInfo.categoryName;
    result.salePrice = goodsInfo.salePrice;
    result.goodsQty = data.quantity;
    result.remark = data.remark;
    result.hasReturnQty = 0;

    return result;
  },
  //数量改变
  handleZanQuantityChange(e) {
    var quantity = e.quantity;

    this.setData({
      ['cartData.quantity']: quantity
    });
  },
  //修改备注
  bindKeyInput(e) {
    this.setData({
      "cartData.remark": e.detail.value
    })
  }
})

module.exports = cartAdd;