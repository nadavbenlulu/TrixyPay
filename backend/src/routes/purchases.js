const express = require('express');
const PartnerLink = require('../models/PartnerLink');
const Purchase = require('../models/Purchase');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');

const router = express.Router();
const paymentMethods = ['card', 'check', 'cash'];

router.use(authenticate);

function parseDate(value, label) {
  if (value === undefined) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? { error: `תאריך ${label} אינו תקין.` } : date;
}

router.get('/', async (req, res, next) => {
  const from = parseDate(req.query.from, 'התחלה');
  const to = parseDate(req.query.to, 'סיום');
  if (from?.error || to?.error) {
    return res.status(400).json({ message: from?.error || to?.error });
  }
  if (from && to && from > to) {
    return res.status(400).json({ message: 'תאריך ההתחלה חייב להיות לפני תאריך הסיום.' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ message: 'החשבון לא נמצא. יש להתחבר מחדש.' });
    }
    const query = user.role === 'business'
      ? { businessId: user.id }
      : { supplierId: user.id };
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = from;
      if (to) query.createdAt.$lte = to;
    }

    const purchases = await Purchase.find(query)
      .populate('businessId supplierId', 'businessName contactName email')
      .sort({ createdAt: -1 })
      .limit(500);
    return res.json({ purchases });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  const { supplierId, items, paymentMethod } = req.body;
  if (typeof supplierId !== 'string' || !Array.isArray(items) || items.length < 1 || items.length > 100) {
    return res.status(400).json({ message: 'יש לבחור ספק ולהוסיף לפחות פריט אחד.' });
  }
  if (!paymentMethods.includes(paymentMethod)) {
    return res.status(400).json({ message: 'יש לבחור אמצעי תשלום תקין.' });
  }

  const cleanItems = [];
  for (const item of items) {
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (
      !name
      || name.length > 120
      || !Number.isFinite(quantity)
      || quantity <= 0
      || !Number.isFinite(unitPrice)
      || unitPrice < 0
    ) {
      return res.status(400).json({ message: 'יש לבדוק את פרטי הפריטים, הכמויות והמחירים.' });
    }
    cleanItems.push({ name, quantity, unitPrice });
  }

  try {
    const business = await User.findById(req.userId);
    if (!business) {
      return res.status(401).json({ message: 'החשבון לא נמצא. יש להתחבר מחדש.' });
    }
    if (business.role !== 'business') {
      return res.status(403).json({ message: 'רק בעל/ת עסק יכול/ה ליצור רכישה.' });
    }
    const link = await PartnerLink.findOne({
      businessId: business.id,
      supplierId,
    });
    if (!link) {
      return res.status(404).json({ message: 'יש להוסיף את הספק לחשבון לפני יצירת רכישה.' });
    }

    const totalAmount = Math.round(
      cleanItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100,
    ) / 100;
    const purchase = await Purchase.create({
      businessId: business.id,
      supplierId,
      items: cleanItems,
      totalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === 'cash' ? 'open' : 'pending',
    });
    await purchase.populate('businessId supplierId', 'businessName contactName email');
    return res.status(201).json({ purchase });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/mark-paid', async (req, res, next) => {
  try {
    const business = await User.findById(req.userId);
    if (!business) {
      return res.status(401).json({ message: 'החשבון לא נמצא. יש להתחבר מחדש.' });
    }
    if (business.role !== 'business') {
      return res.status(403).json({ message: 'רק בעל/ת העסק יכול/ה לעדכן את מצב התשלום.' });
    }

    const purchase = await Purchase.findOne({
      _id: req.params.id,
      businessId: business.id,
    });
    if (!purchase) {
      return res.status(404).json({ message: 'הרכישה לא נמצאה.' });
    }
    purchase.paymentStatus = 'paid';
    purchase.paidAt = new Date();
    await purchase.save();
    await purchase.populate('businessId supplierId', 'businessName contactName email');
    return res.json({ purchase });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'מזהה הרכישה אינו תקין.' });
    }
    return next(error);
  }
});

module.exports = router;
