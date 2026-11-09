const express = require('express');
const PartnerLink = require('../models/PartnerLink');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ message: 'החשבון לא נמצא. יש להתחבר מחדש.' });
    }

    const isBusiness = user.role === 'business';
    const links = await PartnerLink.find(
      isBusiness ? { businessId: user.id } : { supplierId: user.id },
    )
      .populate(isBusiness ? 'supplierId' : 'businessId', 'businessName contactName email')
      .sort({ createdAt: -1 });

    return res.json({
      partners: links.map((link) => (isBusiness ? link.supplierId : link.businessId)),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'יש להזין כתובת דוא״ל תקינה של ספק.' });
  }

  try {
    const business = await User.findById(req.userId);
    if (!business) {
      return res.status(401).json({ message: 'החשבון לא נמצא. יש להתחבר מחדש.' });
    }
    if (business.role !== 'business') {
      return res.status(403).json({ message: 'רק בעל/ת עסק יכול/ה להוסיף ספקים.' });
    }

    const supplier = await User.findOne({ email, role: 'supplier' });
    if (!supplier) {
      return res.status(404).json({ message: 'לא נמצא חשבון ספק עם כתובת הדוא״ל הזו.' });
    }
    if (supplier.id === business.id) {
      return res.status(400).json({ message: 'לא ניתן להוסיף את החשבון שלך כספק.' });
    }

    const link = await PartnerLink.create({
      businessId: business.id,
      supplierId: supplier.id,
    });
    return res.status(201).json({
      partner: {
        id: supplier.id,
        businessName: supplier.businessName,
        contactName: supplier.contactName,
        email: supplier.email,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'הספק כבר נוסף לחשבון.' });
    }
    return next(error);
  }
});

module.exports = router;
