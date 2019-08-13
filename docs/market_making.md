# What is Market Making?

Market making is a trading strategy where the trader simultaneously places both buy and sell orders in an attempt to profit from the bid-ask spread.  Market makers stand ready to both buy and sell from other traders, thus providing liquidity to the market. 

The strategy is appealing to traders because it doesn't require traders to take a directional view of the market - there's money to be made when the market goes up and when the market goes down. It's also heavily incentivized by exchanges looking for liquidity and volume - many exchange operators will pay you to make markets on their exchanges.

## An example

Let's consider a simplified market. Let's say there are three traders: Alice, Bob, and Tim. Alice is looking to sell some of her Bitcoins and Bob is looking to convert some of his USD into Bitcoin. Neither one are savvy about markets or cryptocurrency - they use Bitcoin, but aren't going to lose sleep over trying to get the absolute best prices. Tim is operating Tribeca. Now lets say that the price BTC to USD is $100. Tim could configure Tribeca to send in a buy order for 1 BTC at $95 and a sell order for 1 BTC at $105. Tim would hope that Bob would come along and buy the offered sell order at $105 and Alice would come and sell BTC at $95 - netting Tim $10.

But what if that doesn't happen? What if the price of BTC/USD jumps to $103? Now Tim's buy order seems really uncompetitive at $95 - Alice doesn't want to sell for that little. And Bob could get a pretty good deal by getting the BTC at only two extra dollars. To prevent this scenario, Tim's Tribeca would readjust the orders by cancelling the $95-$105 orders and placing a new set of orders - also known as making a market - at $98-$108.

Like in any market these days, Bob and Alice probably aren't humans clicking buttons. They certainly aren't humans shouting on a floor in lower Manhattan. More likely, they are also computerized algorithms capable of placing orders in milliseconds. To survive as a market maker, you need to be faster than those algorithms to make a profit.

# So, how does Tribeca work?

As previously mentioned, market making is really the art of figuring out the price of something, then making a market around that price. So how do we know what is the real price of Bitcoin? Well... we don't. And of course the price of Bitcoin now might be radically different than the price in a day, in an hour, or even in a second from now. The best we can do is to build an estimate, or fair value, of the price of Bitcoin. In Tribeca, we consume the market data from the exchange we are sending orders into as a starting point. That includes the best bids and offers and most recent trades (aka market trades) by other participants in the market.

From our fair value, we then need to make a market around that price. Back to our hypothetical example with Bob and Alice: we could make our market as $95-$105, we could have also made it $99.99-$101.01, or we could have also done $47-$332.21. So how do we decide? That's where the quoting parameters come into play. Those parameters dictate how wide of a market to make (wide=askPrice-bidPrice) and what size we want our quotes in the market to be. The procedure for coming up with profitable parameters is both an art and a science - there is no one size fits all formula.

When Tribeca figures out a suitable market, Tribeca will then send in the buy and sell orders. Hopefully it's able to buy for less then sell for more, and repeat many times per day. Sometimes that's not always the case - sometimes there are genuinely more buyers than sellers for the prices you are setting. Often this comes when the market is moving very fast in one direction. Luckily, Tribeca will prevent you from selling too fast without finding corresponding buyers and will stop sending orders in the imbalanced side. 

## Where does all this happen in the code?

The code is organized into 3 layers.

1) Engine layer - The brains of the application. Portion of the code responsible for synthesizing market data, open order status, position, fees, trades, safety information and converting that into a quote to send to the exchange. This is the portion of the code which calculates a fair value (`FairValueEngine`) and generates quotes (`QuotingEngine`)

2) Adapter layer - The engine layer should have no idea about the individual quirks of the exchanges. The engine layer uses the adapter layer to carry out its bidding. The adapter layer also has no idea that it is being used in a manner to make markets. In theory, the adapter layer code and the gateway layer code could be divorced from the Engine layer and we could build a technical analysis or latency arbitrage bot, instead. The adapter layer also contains all the state reported by the gateways.

3) Gateway layer - Each exchange has their own API for interacting with the exchange. All of that business is hidden behind 4 different interfaces: 

  * `IMarketDataGateway`: Handles order book updates and market trade updates.
  * `IOrderEntryGateway`: Send and cancel orders and handle updates to the orders.
  * `IPositionGateway`: Pulls in the latest position (how much BTC and USD do I have?) information
  * `IExchangeDetailsGateway`: Read-only information describing naming and exchange fee structure.

Gateways are ideally stateless (some state may be needed in order to perform exchange-specific functionality) and are mostly translation layers between exchange APIs and the Tribeca API.

# How do I see what's going on?

Navigate to the Web UI as described in the install process. You should see a screen like:

![](https://github.com/michaelgrosner/tribeca/blob/master/docs/tribeca_main.png)

* Market Data and Quotes - this is perhaps the most important screen in the app. 

  * The top row in blue with "q" is the quote that you generate via the Quoting Parameters supplied. If the text is grey, the generated quotes are not in the market, and green when they are. 

  * "FV" is the fair value price calculated by Tribeca as the starting point for the generated quote. 

  * The "mkt" rows are the best bids and offers on the exchange you are connected to.

* Trades - Trades done by your exchange account. "side" is the side which your order was sent as. "val" is the total value of the trade, which is price * size +/- total exchange fee

* Market Trades - Trades done by all participants in the market. "ms" is the side that was the make side (provided liquidity). The columns starting with "q" are your quotes at the time of the trade, the columns starting with "m" are the best bid and offer information at the time of the trade.

* Quoting Parameters - All of the parameters needed to generate a quote. See the section "How do I control Tribeca's quotes?" for each field's description.

* Positions - Shows holdings of each currency pair you are using.

* Order List - Shows order statuses of each order sent to the exchange. 

  * "Cxl" - clicking the red button will attempt to cancel the order.

# How do I control Tribeca's quotes?

In the web UI, there are two rows of panels with cryptic looking names and editable textboxes. Those are the quoting parameters, the knobs which we can turn to affect how Tribeca will trade.

* `mode` - Sets the quoting mode

  * `Join` - Sets our quote to be at the best bid and the best offered price, If the BBO is narrower than `width`, set our bid quote at `FV - width / 2` and ask quote at `FV + width / 2`.

  * `Top` - Same as `Join`, but if the code can better the best bid or offer by a penny while respecting the `width`, set that as the quote so we will then be at the top of the market.

  * `Mid` - Set our bid quote at `FV - width / 2` and ask quote at `FV + width / 2`

  * `Inverse Join` - Set the quote at the BBO if the BBO is narrower than `width`, otherwise make the quote so wide that no one will trade with it.

  * `Inverse Top` - Same as `Inverse Join` but make our orders jump to the very top of the order book.

  * `PingPong` - Same as `Top` but always respect the calculated `width` from the last sold or bought `size`.

* `fv` - Sets the fair value calculation mode

  * `BBO` - `FV = ([best bid price] + [best ask price])/2.0`

  * `wBBO` - `FV = ([best bid price]*[best ask size] + [best ask price]*[best bid size])/([best ask size] + [best bid size])`

* `apMode`

  * `Off` - Tribeca will not try to automatically manage positions.

  * `EwmaBasic` - Tribeca will use a 200 minute and 100 minute exponential weighted moving average calculation to buy up BTC when the 100 minute line crosses over the 200 minute line, and sell BTC when the reverse happens. The values of 100mins and 200mins are currently not exposed in the UI, but are represented in the code as `shortEwma` and `longEwma`.

* `width` - Minimum width of our quote in USD (ex. a value of .3 is 30 cents). With the exception for when `apr` is checked and the system is aggressively rebalancing positions after they get out of whack, `width` shall never be violated.

* `size` - Maximum size of our quote in BTC (ex. a value of 1.5 is 1.5 bitcoins). With the exception for when `apr` is checked and the system is aggressively rebalancing positions after they get out of whack, `size` shall never be violated.

* `tbp` - Only used when `apMode` is `Off`. Sets a static "Target Base Position" for Tribeca to stay near. In off auto-position mode, Tribeca will still try to respect `pDiv` and not make your position fluctuate by more than that value. So if you have 10 BTC to trade, set `tbp = 3`, set `apMode = Off`, and `pDiv = 1`, your holding of BTC will never be less than 2 or greater than 4. 

* `pDiv` - If your "Target Base Position" diverges more from this value, Tribeca will stop sending orders to stop too much directional trading. So if you have 10 BTC to trade, "Target Base Position" is reporting 5, and `pDiv` is set to 3, your holding of BTC will never be less than 2 or greater than 8.

* `ewma?` - Use a 100 minute EWMA smoothed line of the price to not send 

* `apr?` - If you're in a state where Tribeca has stopped sending orders because your position has diverged too far from Target Base Position, this setting will much more aggressively try to fix that discrepancy by placing orders much larger than `size` and at prices much more aggressive than `width` normally allows. It's a bit risky to use this setting.

* `trds` - Often, only buying or selling many times in a short timeframe indicates that there is going to be a price swing. `trds` and `/sec` are highly related: If you do more than `trds` buy trades in `/sec` seconds, Tribeca will stop sending more buy orders until either `/sec` seconds has passed, or you have sold enough at a higher cost to make all those buy orders profitable. The number of trades is reported by side in the UI; "BuyTS", "SellTS", and "TotTS". If "BuyTS" goes above `trds`, Tribeca will stop sending buy orders, and the same for sells. For example, if `trds` is 2 and `/sec` is 1800 (half an hour):

Time     | Side | Price | Size | BuyTS | SellTS | Notes
-------- |------|------:|-----:|------:|-------:|------------------------------------------------:
12:00:01 | Buy  | 10    | 1    | 1     | 0      |
12:00:02 | Buy  | 10    | 0.5  | 1.5   | 0      | Partial fills of `size` get counted fractionally
12:00:03 | Sell | 11    | 0.75 | 0.75  | 0      | Sell for more decrements the imbalance
12:00:05 | Sell | 5     | 0.75 | 0.75  | 0      | Sell for less than the other buys doesn't help
12:00:06 | Buy  | 10    | 0.5  | 1.75  | 0      | 
12:00:07 | Buy  | 10    | 0.5  | 2.75  | 0      | Stop sending buy orders until 12:30:07!

* `/sec` - see `trds`

# How can I make up my own trading strategies?

Lets say that you have a great idea about how to profitably make markets and are comfortable getting your hands dirty in some TypeScript.  The steps are quite easy

1. Create a class implementing `QuoteStyle` found in `src/service/quoting-styles/helpers.ts`. As part of implementing the interface, you'll need to create a new enum member for `QuotingMode` in models.ts. Inside that class you can create any sort of logic to create a two-sided market, or return null to signify that there should be no quote in the market. The interface gives you:

  a. The latest order book depth of the market. On most exchanges, this is the best 3 price levels. Individual orders are not supported since not all exchanges support that functionality. Last trades in the market are also not yet provided (though reasonably should in the future).

  b. The calculated fair value. 

  c. The current quoting parameters, viewable in the web UI. 

2. Install the new class alongside the provided list of modes in the `QuotingStyleRegistry` in `main.js`.

3. Rebuild and restart tribeca. 

# How can I test new trading strategies?

Tribeca is packaged with a backtesting mode.
