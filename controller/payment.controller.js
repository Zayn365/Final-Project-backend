const { v4: uuidv4 } = require("uuid");
const fetch = require("node-fetch");

function isValidHttpResponse(response) {
  return response.ok && response.status >= 200 && response.status < 300;
}

async function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

async function initiateSepaPayment(req, res) {
  try {
    const {
      amount,
      customerName,
      customerEmail,
      customerPhone,
      orderItems,
      returnUrl,
      isOtherCard,
    } = req.body;
    console.log("TCL ~ initiateSepaPayment ~ returnUrl:", returnUrl);

    if (!amount || !customerName || !customerEmail) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const paymentId = "Payment" + uuidv4().replace(/-/g, "");
    const customerId = "Customer" + uuidv4().replace(/-/g, "");

    const formData = new URLSearchParams();
    formData.append("ACTION", "SESSIONTOKEN");
    // formData.append(
    //   "MERCHANTUSER",
    //   !isOtherCard ? "store2@bikev.k12.tr" : "store@bikev.k12.tr"
    // );
    formData.append("MERCHANTUSER", "store2@bikev.k12.tr");
    // formData.append("MERCHANTPASSWORD", "Bikev1996...."); // Replace with env var in production
    formData.append("MERCHANTPASSWORD", "Bikevegitim1996."); // Replace with env var in production
    // formData.append("MERCHANT", !isOtherCard ? "10010177" : "10010500");
    formData.append("MERCHANT", "10010177");
    formData.append("AMOUNT", String(amount));
    formData.append("CURRENCY", "TRY");
    formData.append("MERCHANTPAYMENTID", paymentId);
    formData.append(
      "RETURNURL",
      returnUrl ||
        "https://final-project-backend-m9nb.onrender.com/payment/result"
    );
    formData.append("CUSTOMER", customerId);
    formData.append("CUSTOMERNAME", customerName);
    formData.append("CUSTOMEREMAIL", customerEmail);
    formData.append("CUSTOMERIP", req.ip || "127.0.0.1");
    formData.append(
      "CUSTOMERUSERAGENT",
      req.headers["user-agent"] || "Mozilla/5.0"
    );
    formData.append("NAMEONCARD", customerName);
    formData.append("CUSTOMERPHONE", customerPhone || "5380000000");

    formData.append(
      "ORDERITEMS",
      JSON.stringify(
        Array.isArray(orderItems) && orderItems.length
          ? orderItems
          : [
              {
                productCode: "2514",
                name: "108269",
                description: "book",
                quantity: 1,
                amount: amount,
              },
            ]
      )
    );

    formData.append("DISCOUNTAMOUNT", "");
    formData.append("BILLTOADDRESSLINE", "Road");
    formData.append("BILLTOCITY", "Istanbul");
    formData.append("BILLTOCOUNTRY", "Turkey");
    formData.append("BILLTOPOSTALCODE", "1103");
    formData.append("BILLTOPHONE", "123456789");
    formData.append("SHIPTOADDRESSLINE", "Road");
    formData.append("SHIPTOCITY", "Ankara");
    formData.append("SHIPTOCOUNTRY", "Turkey");
    formData.append("SHIPTOPOSTALCODE", "1105");
    formData.append("SHIPTOPHONE", "987654321");
    formData.append("SESSIONTYPE", "PAYMENTSESSION");

    const response = await fetch(
      // "https://test.ziraatpay.com.tr/ziraatpay/api/v2",
      "https://vpos.ziraatpay.com.tr/ziraatpay/api/v2",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      }
    );

    const text = await response.text();
    const json = await parseJsonSafely(text);

    if (!isValidHttpResponse(response)) {
      return res
        .status(response.status)
        .json({ error: "ZiraatPay session request failed", raw: text });
    }

    if (json) {
      return res.json(json);
    }

    return res
      .status(500)
      .json({ error: "Invalid response from ZiraatPay", raw: text });
  } catch (err) {
    console.error("Error requesting session token:", err);
    return res.status(500).json({ error: "Failed to request session token" });
  }
}

async function payWithCard(req, res) {
  try {
    const { sessionToken, cardPan, cardExpiry, cardCvv, nameOnCard } = req.body;

    if (!sessionToken || !cardPan || !cardExpiry || !cardCvv || !nameOnCard) {
      return res.status(400).json({ error: "Missing card details" });
    }

    const formData = new URLSearchParams();
    formData.append("ACTION", "SALE");
    formData.append("SESSIONTOKEN", sessionToken);
    formData.append("CARDPAN", cardPan);
    formData.append("CARDEXPIRY", cardExpiry); // format: MM/YY
    formData.append("CARDCVV", cardCvv);
    formData.append("INSTALLMENTS", "1");
    formData.append("NAMEONCARD", nameOnCard);
    formData.append("CARDOWNER", nameOnCard);

    const response = await fetch(
      // "https://test.ziraatpay.com.tr/ziraatpay/api/v2",
      "https://vpos.ziraatpay.com.tr/ziraatpay/api/v2",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      }
    );

    const text = await response.text();
    const json = await parseJsonSafely(text);

    if (!isValidHttpResponse(response)) {
      return res
        .status(response.status)
        .json({ error: "Card payment failed", raw: text });
    }

    if (json) {
      return res.json(json);
    }

    return res
      .status(500)
      .json({ error: "Invalid response from card processor", raw: text });
  } catch (err) {
    console.error("Card Payment Error:", err);
    return res.status(500).json({ error: "Failed to process card payment" });
  }
}

async function payByLink(req, res) {
  try {
    const {
      amount,
      customerEmail,
      customerName,
      customerPhone,
      returnUrl,
      merchantPaymentId,
    } = req.body;

    if (!amount || !customerEmail || !customerName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const formData = new URLSearchParams();
    formData.append("ACTION", "PAYBYLINKPAYMENT");
    formData.append("MERCHANTUSER", "store@bikev.k12.tr");
    formData.append("MERCHANTPASSWORD", "Bikev1996....");
    formData.append("MERCHANT", "10009092");
    formData.append("CUSTOMER", "Customer-" + uuidv4().replace(/-/g, ""));
    formData.append("SESSIONTYPE", "PAYMENTSESSION");
    formData.append("MERCHANTPAYMENTID", merchantPaymentId || "TESTLINK");
    formData.append("AMOUNT", String(amount));
    formData.append("CURRENCY", "TRY");
    formData.append("CUSTOMEREMAIL", customerEmail);
    formData.append("CUSTOMERNAME", customerName);
    formData.append("CUSTOMERPHONE", customerPhone);
    formData.append(
      "RETURNURL",
      returnUrl || "https://yourdomain.com/payment/return"
    );
    formData.append("SESSIONEXPIRY", "168h");

    const response = await fetch(
      "https://test.ziraatpay.com.tr/ziraatpay/api/v2",
      // "https://vpos.ziraatpay.com.tr/ziraatpay/api/v2",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      }
    );

    const text = await response.text();
    const json = await parseJsonSafely(text);

    if (!isValidHttpResponse(response)) {
      return res
        .status(response.status)
        .json({ error: "Pay-by-link failed", raw: text });
    }

    if (json && json.token) {
      return res.json({
        ...json,
        paymentLink: `https://test.ziraatpay.com.tr/payment/token/${json.token}`,
      });
    }

    return res.status(500).json({ error: "Invalid token response", raw: text });
  } catch (err) {
    console.error("Pay-by-Link Error:", err);
    return res.status(500).json({ error: "Failed to initiate pay-by-link" });
  }
}

async function generate3DSecureSession(req, res) {
  try {
    const {
      amount,
      customerName,
      customerEmail,
      customerPhone,
      orderItems,
      returnUrl,
    } = req.body;

    if (!amount || !customerName || !customerEmail) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const paymentId = "Payment" + uuidv4().replace(/-/g, "");
    const customerId = "Customer" + uuidv4().replace(/-/g, "");
    const query = new URLSearchParams(req.body).toString();

    const formData = new URLSearchParams();
    formData.append("ACTION", "SESSIONTOKEN");
    formData.append("MERCHANTUSER", "store@bikev.k12.tr");
    formData.append("MERCHANTPASSWORD", "Bikev1996....");
    // formData.append("MERCHANT", "10009092"); TEST
    formData.append("MERCHANT", "10010500");
    formData.append("AMOUNT", String(amount));
    formData.append("CURRENCY", "TRY");
    formData.append("MERCHANTPAYMENTID", paymentId);
    formData.append("RETURNURL", returnUrl || "https://store.bikev.k12.tr/");
    formData.append("CUSTOMER", customerId);
    formData.append("CUSTOMERNAME", customerName);
    formData.append("CUSTOMEREMAIL", customerEmail);
    formData.append("CUSTOMERPHONE", customerPhone || "5380000000");
    formData.append("CUSTOMERIP", req.ip || "127.0.0.1");
    formData.append(
      "CUSTOMERUSERAGENT",
      req.headers["user-agent"] || "Mozilla/5.0"
    );
    formData.append(
      "ORDERITEMS",
      JSON.stringify(
        Array.isArray(orderItems) && orderItems.length
          ? orderItems
          : [
              {
                productCode: "2514",
                name: "108269",
                description: "book",
                quantity: 1,
                amount: amount,
              },
            ]
      )
    );
    formData.append("SESSIONTYPE", "PAYMENTSESSION");

    const response = await fetch(
      // "https://test.ziraatpay.com.tr/ziraatpay/api/v2",
      "https://vpos.ziraatpay.com.tr/ziraatpay/api/v2",

      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      }
    );

    console.log("TCL ~ generate3DSecureSession ~ response:", response);
    const text = await response.text();
    console.log("TCL ~ generate3DSecureSession ~ text:", text);
    const json = await parseJsonSafely(text);

    if (!isValidHttpResponse(response)) {
      return res
        .status(response.status)
        .json({ error: "Failed to create 3D session", error: json });
    }

    if (json && json.sessionToken) {
      return res.json({ sessionToken: json.sessionToken });
    }

    return res
      .status(500)
      .json({ error: "Invalid response from ZiraatPay", error: json });
  } catch (err) {
    console.error("3D Secure Session Error:", err);
    return res
      .status(500)
      .json({ error: "Failed to create 3D secure session" });
  }
}

module.exports = {
  initiateSepaPayment,
  payWithCard,
  payByLink,
  generate3DSecureSession,
};
