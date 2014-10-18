/// <reference path="utils.ts" />

class ExchangeBroker implements IBroker {
    cancelOpenOrders() : void {
        for (var k in this._allOrders) {
            var e : OrderStatusReport = this._allOrders[k].last();

            switch (e.orderStatus) {
                case OrderStatus.New:
                case OrderStatus.PartialFill:
                case OrderStatus.Working:
                    this.cancelOrder(new OrderCancel(e.orderId, e.exchange));
                    break;
            }
        }
    }

    allOrderStates() : Array<OrderStatusReport> {
        var os : Array<OrderStatusReport> = [];
        for (var k in this._allOrders) {
            var e = this._allOrders[k];
            for (var i = 0; i < e.length; i++) {
                os.push(e[i]);
            }
        }
        return os;
    }

    OrderUpdate : Evt<OrderStatusReport> = new Evt<OrderStatusReport>();
    _allOrders : { [orderId: string]: OrderStatusReport[] } = {};

    private static generateOrderId = () => {
        return new Date().getTime().toString(32)
    };

    sendOrder = (order : Order) => {
        var rpt : OrderStatusReport = {
            orderId: ExchangeBroker.generateOrderId(),
            side: order.side,
            quantity: order.quantity,
            type: order.type,
            time: new Date(),
            price: order.price,
            timeInForce: order.timeInForce,
            orderStatus: OrderStatus.New,
            exchange: this.exchange()};
        this._log("sending order %o", rpt);
        this._allOrders[rpt.orderId] = [rpt];
        var brokeredOrder = new BrokeredOrder(rpt.orderId, rpt.side, rpt.quantity, rpt.type,
            rpt.price, rpt.timeInForce, rpt.exchange);
        this._gateway.sendOrder(brokeredOrder);
    };

    replaceOrder = (replace : CancelReplaceOrder) => {
        var rpt = this._allOrders[replace.origOrderId].last();
        var br = new BrokeredReplace(ExchangeBroker.generateOrderId(), replace.origOrderId, rpt.side,
            replace.quantity, rpt.type, replace.price, rpt.timeInForce, rpt.exchange, rpt.exchangeId);
        this._log("cancel-replacing order %o %o", rpt, br);
        this._gateway.replaceOrder(br);
    };

    cancelOrder = (cancel : OrderCancel) => {
        var rpt = this._allOrders[cancel.origOrderId].last();
        var cxl = new BrokeredCancel(cancel.origOrderId, ExchangeBroker.generateOrderId(), rpt.side, rpt.exchangeId);
        this._log("cancelling order %o with %o", rpt, cxl);
        this._gateway.cancelOrder(cxl);
    };

    public onOrderUpdate = (osr : GatewayOrderStatusReport) => {
        var orig : OrderStatusReport = this._allOrders[osr.orderId].last();

        if (typeof orig === "undefined") {
            this._log("Cannot get OrderStatusReport for %o, bailing === %o", osr, this._allOrders[osr.orderId]);
            return;
        }

        this._log("got gw update %o, applying to %o", osr, orig);

        var o : OrderStatusReport = {
            orderId: osr.orderId || orig.orderId,
            orderStatus: osr.orderStatus || orig.orderStatus,
            rejectMessage: osr.rejectMessage || orig.rejectMessage,
            time: osr.time || orig.time,
            lastQuantity: osr.lastQuantity || orig.lastQuantity,
            lastPrice: osr.lastPrice || orig.lastPrice,
            leavesQuantity: osr.leavesQuantity || orig.leavesQuantity,
            cumQuantity: osr.cumQuantity || orig.cumQuantity,
            averagePrice: osr.averagePrice || orig.averagePrice,
            side: orig.side,
            quantity: orig.quantity,
            type: orig.type,
            price: orig.price,
            timeInForce: orig.timeInForce,
            exchange: orig.exchange,
            exchangeId: osr.exchangeId || orig.exchangeId
        };
        this._allOrders[osr.orderId].push(o);
        this._log("applied gw update -> %o", o);

        this.OrderUpdate.trigger(o);
    };

    makeFee() : number {
        return this._gateway.makeFee();
    }

    takeFee() : number {
        return this._gateway.takeFee();
    }

    MarketData : Evt<MarketBook> = new Evt();

    name() : string {
        return this._gateway.name();
    }

    exchange() : Exchange {
        return this._gateway.exchange();
    }

    _currentBook : MarketBook = null;
    _gateway : IGateway;
    _log : Logger;

    public currentBook = () : MarketBook => {
        return this._currentBook;
    };

    private handleMarketData = (book : MarketBook) => {
        if (this._currentBook == null || (!book.top.equals(this._currentBook.top) || !book.second.equals(this._currentBook.second))) {
            this._currentBook = book;
            this.MarketData.trigger(book);
            this._log(book);
        }
    };

    public onConnect = (cs : ConnectivityStatus) => {
        this._log("Connection status changed ", ConnectivityStatus[cs]);
    };

    constructor(gateway : IGateway) {
        this._log = log("Hudson:ExchangeBroker:" + gateway.name());
        this._gateway = gateway;
        this._gateway.MarketData.on(this.handleMarketData);
        this._gateway.ConnectChanged.on(this.onConnect);
        this._gateway.OrderUpdate.on(this.onOrderUpdate);
    }
}