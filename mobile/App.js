import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  apiRequest,
  authenticateBiometricLogin,
  clearAccessToken,
  disableBiometricLogin,
  enableBiometricLogin,
  hasAccessToken,
  isBiometricLoginEnabled,
  saveAccessToken,
} from './src/api';

const colors = {
  navy: '#10283F',
  teal: '#20C7AE',
  background: '#F2F6F8',
  muted: '#748694',
  ink: '#172F40',
  border: '#DFE8ED',
  white: '#FFFFFF',
  danger: '#B42318',
};

const inputFields = [
  { key: 'contactName', label: 'שם מלא', placeholder: 'איך לפנות אליך?' },
  { key: 'businessName', label: 'שם העסק', placeholder: 'לדוגמה: קפה השדרה' },
  { key: 'username', label: 'שם משתמש', placeholder: '3–30 תווים באנגלית' },
  { key: 'email', label: 'דוא״ל', placeholder: 'name@example.com', keyboardType: 'email-address' },
  { key: 'identifier', label: 'שם משתמש או דוא״ל', placeholder: 'שם משתמש או name@example.com' },
  { key: 'password', label: 'סיסמה', placeholder: 'לפחות 10 תווים', secureTextEntry: true },
  { key: 'confirmPassword', label: 'אימות סיסמה', placeholder: 'הקלד/י שוב את הסיסמה', secureTextEntry: true },
];

function BrandMark() {
  return (
    <View style={styles.brandRow}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>T</Text>
      </View>
      <Text style={styles.brandName}>Trix<Text style={styles.brandAccent}>Pay</Text></Text>
    </View>
  );
}

function SplashScreen() {
  return (
    <View style={styles.splashScreen}>
      <View style={styles.splashBrand}>
        <View style={styles.splashLogo}>
          <Text style={styles.splashLogoText}>T</Text>
        </View>
        <Text style={styles.splashBrandName}>
          Trix<Text style={styles.brandAccent}>Pay</Text>
        </Text>
      </View>
      <ActivityIndicator size="small" color={colors.teal} style={styles.splashIndicator} />
    </View>
  );
}

function ProfileSettings({ user, onProfileUpdated }) {
  const [profile, setProfile] = useState(null);
  const [businessName, setBusinessName] = useState(user.businessName || '');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchNumber, setBranchNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [nameWarningAccepted, setNameWarningAccepted] = useState(false);
  const [canEditBusinessName, setCanEditBusinessName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/profile');
      setProfile(result.profile);
      setBusinessName(result.profile.businessName);
      setRegistrationNumber(result.profile.businessRegistrationNumber);
      setProfileImage(result.profile.profileImage);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadProfile, 0);
    return () => clearTimeout(timer);
  }, [loadProfile]);

  async function chooseImage() {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        setError('לא ניתן לקרוא את התמונה. נסו לבחור תמונה אחרת.');
        return;
      }
      const mimeType = ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)
        ? asset.mimeType
        : 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${asset.base64}`;
      if (dataUrl.length > 700000) {
        setError('התמונה גדולה מדי. יש לבחור תמונה קטנה יותר.');
        return;
      }
      setProfileImage(dataUrl);
    } catch (requestError) {
      setError(requestError.message || 'לא ניתן לבחור את התמונה.');
    }
  }

  async function saveProfile() {
    if (!profile) return;
    setError('');
    setNotice('');
    if (businessName.trim() !== profile.businessName && !canEditBusinessName) {
      setError('כדי לשנות את שם העסק, יש לאשר תחילה את ההודעה לגבי חשבוניות וצ׳קים.');
      return;
    }

    const bankValues = [bankName, branchNumber, accountNumber, accountHolder];
    const hasSomeBankValue = bankValues.some((value) => value.trim());
    if (hasSomeBankValue && bankValues.some((value) => !value.trim())) {
      setError('כדי לשמור חשבון בנק יש למלא את כל ארבעת השדות.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        businessRegistrationNumber: registrationNumber.trim(),
        profileImage,
      };
      if (businessName.trim() !== profile.businessName) {
        payload.businessName = businessName.trim();
        payload.businessNameConfirmed = true;
      }
      if (hasSomeBankValue) {
        payload.bankName = bankName.trim();
        payload.branchNumber = branchNumber.trim();
        payload.accountNumber = accountNumber.trim();
        payload.accountHolder = accountHolder.trim();
      }
      const result = await apiRequest('/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setProfile(result.profile);
      setBusinessName(result.profile.businessName);
      setRegistrationNumber(result.profile.businessRegistrationNumber);
      setProfileImage(result.profile.profileImage);
      setBankName('');
      setBranchNumber('');
      setAccountNumber('');
      setAccountHolder('');
      setCanEditBusinessName(false);
      onProfileUpdated({
        businessName: result.profile.businessName,
        profileImage: result.profile.profileImage,
      });
      setNotice('הפרופיל נשמר בהצלחה.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <ActivityIndicator size="large" color={colors.teal} style={styles.profileLoading} />;
  }
  if (!profile) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>לא ניתן לטעון את הפרופיל</Text>
        {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
        <Pressable accessibilityRole="button" onPress={loadProfile} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>ניסיון חוזר</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.profileContent}>
      <View style={styles.profileHeading}>
        <Text style={styles.panelTitle}>
          {user.role === 'business' ? 'פרופיל והגדרות העסק' : 'פרופיל הספק'}
        </Text>
        <Text style={styles.cardSubtitle}>
          ניהול פרטי החשבון, תמונת הפרופיל ופרטי חשבון הבנק.
        </Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>תמונת פרופיל</Text>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarFallback}>{user.contactName?.[0] || 'T'}</Text>
            )}
          </View>
          <View style={styles.avatarActions}>
            <Text style={styles.cardSubtitle}>הוסיפו תמונה לזיהוי החשבון.</Text>
            <Pressable accessibilityRole="button" onPress={chooseImage} style={styles.outlineButton}>
              <Text style={styles.outlineButtonText}>{profileImage ? 'בחירת תמונה אחרת' : 'הוספת תמונה'}</Text>
            </Pressable>
            {profileImage ? (
              <Pressable accessibilityRole="button" onPress={() => setProfileImage('')}>
                <Text style={styles.removePhotoText}>הסרת תמונה</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>פרטי העסק</Text>
        <Text style={styles.fieldLabel}>שם העסק שיופיע במסמכים</Text>
        <TextInput
          accessibilityLabel="שם העסק"
          editable={canEditBusinessName}
          onChangeText={(value) => {
            if (canEditBusinessName) setBusinessName(value);
          }}
          placeholder="שם העסק"
          placeholderTextColor="#9AA8B5"
          readOnly={!canEditBusinessName}
          style={[styles.input, !canEditBusinessName && styles.readOnlyInput]}
          textAlign="right"
          value={businessName}
        />
        {!canEditBusinessName ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => { setNameWarningAccepted(false); setNameModalVisible(true); }}
            style={styles.editNameButton}
          >
            <Text style={styles.editNameText}>הגדרת שם העסק למסמכים</Text>
          </Pressable>
        ) : (
          <Text style={styles.nameEditHint}>לאחר השמירה, שם העסק המעודכן יוצג בחשבון ובמסמכים.</Text>
        )}
        <Text style={[styles.fieldLabel, styles.spacedLabel]}>ח.פ / מספר עוסק מורשה</Text>
        <TextInput
          accessibilityLabel="ח.פ / מספר עוסק מורשה"
          keyboardType="number-pad"
          onChangeText={setRegistrationNumber}
          placeholder="מספר העסק"
          placeholderTextColor="#9AA8B5"
          style={styles.input}
          textAlign="right"
          value={registrationNumber}
        />
        <Text style={styles.formHint}>שם העסק שתגדירו מיועד להופיע במסמכי העסק. בדקו שהוא תואם לפרטים הרשומים בבנק.</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>פרטי חשבון בנק</Text>
        <Text style={styles.cardSubtitle}>
          פרטים בסיסיים בלבד, לשמירה בפרופיל. אין להזין סיסמת בנק או פרטי התחברות.
        </Text>
        {profile.bankDetailsSaved ? (
          <Text style={styles.savedBankText}>
            קיים חשבון שמספרו מסתיים ב־{profile.bankAccountLast4}. למען הגנת הפרטים, המספר המלא אינו מוצג כאן.
          </Text>
        ) : null}
        <Text style={styles.fieldLabel}>שם הבנק</Text>
        <TextInput
          accessibilityLabel="שם הבנק"
          onChangeText={setBankName}
          placeholder="לדוגמה: שם הבנק"
          placeholderTextColor="#9AA8B5"
          style={styles.input}
          textAlign="right"
          value={bankName}
        />
        <View style={styles.purchaseFieldsRow}>
          <View style={styles.purchaseField}>
            <Text style={styles.fieldLabel}>מספר סניף</Text>
            <TextInput
              accessibilityLabel="מספר סניף"
              keyboardType="number-pad"
              onChangeText={setBranchNumber}
              placeholder="סניף"
              placeholderTextColor="#9AA8B5"
              style={styles.input}
              textAlign="right"
              value={branchNumber}
            />
          </View>
          <View style={styles.purchaseField}>
            <Text style={styles.fieldLabel}>מספר חשבון</Text>
            <TextInput
              accessibilityLabel="מספר חשבון"
              keyboardType="number-pad"
              onChangeText={setAccountNumber}
              placeholder={profile.bankDetailsSaved ? 'הזינו מחדש לעדכון' : 'מספר חשבון'}
              placeholderTextColor="#9AA8B5"
              secureTextEntry
              style={styles.input}
              textAlign="right"
              value={accountNumber}
            />
          </View>
        </View>
        <Text style={styles.fieldLabel}>שם בעל/ת החשבון</Text>
        <TextInput
          accessibilityLabel="שם בעל/ת החשבון"
          onChangeText={setAccountHolder}
          placeholder="כפי שמופיע בחשבון"
          placeholderTextColor="#9AA8B5"
          style={styles.input}
          textAlign="right"
          value={accountHolder}
        />
        <Text style={styles.formHint}>
          מספר החשבון מוצפן בעת שמירתו. בשלב זה לא מתבצעים חיבור לבנק, חיובים או יצירת צ׳קים.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={saveProfile}
        style={[styles.primaryButton, saving && styles.disabledButton]}
      >
        {saving ? <ActivityIndicator color={colors.white} /> : (
          <Text style={styles.primaryButtonText}>שמירת פרטי הפרופיל</Text>
        )}
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
        transparent
        visible={nameModalVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmModal}>
            <Text style={styles.modalTitle}>חשוב לפני שמגדירים שם עסק</Text>
            <Text style={styles.modalText}>
              שם העסק שתקלידו יוצג במסמכי העסק ובצ׳קים עתידיים. כדי למנוע דחיית צ׳ק, יש לוודא שהשם תואם לשם המוכר בבנק.
            </Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: nameWarningAccepted }}
              onPress={() => setNameWarningAccepted((accepted) => !accepted)}
              style={styles.confirmRow}
            >
              <View style={[styles.checkbox, nameWarningAccepted && styles.checkboxChecked]}>
                {nameWarningAccepted ? <Text style={styles.checkboxCheck}>✓</Text> : null}
              </View>
              <Text style={styles.confirmText}>קראתי ואני מאשר/ת את ההודעה.</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!nameWarningAccepted}
              onPress={() => {
                setCanEditBusinessName(true);
                setNameModalVisible(false);
              }}
              style={[styles.primaryButton, !nameWarningAccepted && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>אישור והמשך להזנת השם</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setNameModalVisible(false)}
              style={styles.cancelModalButton}
            >
              <Text style={styles.outlineButtonText}>ביטול</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Dashboard({
  user,
  busy,
  biometricEnabled,
  onBiometricLoginChanged,
  onLogout,
  onProfileUpdated,
}) {
  const [partners, setPartners] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [purchaseSummary, setPurchaseSummary] = useState({
    totalAmount: 0,
    paidAmount: 0,
    openAmount: 0,
    purchaseCount: 0,
  });
  const [period, setPeriod] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [view, setView] = useState('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [supplierEmail, setSupplierEmail] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isBusiness = user.role === 'business';
  const amount = (value) => new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 2,
  }).format(value || 0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [purchaseResult, summaryResult, partnerResult] = await Promise.all([
        apiRequest('/purchases'),
        apiRequest('/purchases/summary'),
        isBusiness ? apiRequest('/partners') : Promise.resolve(null),
      ]);
      setPurchases(purchaseResult.purchases);
      setPurchaseSummary(summaryResult.summary);
      if (partnerResult) {
        const availablePartners = partnerResult.partners;
        setPartners(availablePartners);
        setSelectedSupplierId((current) => (
          availablePartners.some((partner) => (partner._id || partner.id) === current)
            ? current
            : availablePartners[0]?._id || availablePartners[0]?.id || ''
        ));
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [isBusiness]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  async function addSupplier() {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await apiRequest('/partners', {
        method: 'POST',
        body: JSON.stringify({ email: supplierEmail.trim() }),
      });
      setSupplierEmail('');
      setNotice('הספק נוסף לחשבון.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function createPurchase() {
    const parsedQuantity = Number(quantity);
    const parsedUnitPrice = Number(unitPrice);
    const items = [...purchaseItems];
    if (itemName.trim()) {
      if (unitPrice.trim() === '' || !Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0 || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        setError('יש לבדוק את הכמות והמחיר של הפריט.');
        return;
      }
      items.push({ name: itemName.trim(), quantity: parsedQuantity, unitPrice: parsedUnitPrice });
    }
    if (!selectedSupplierId || !items.length) {
      setError('יש לבחור ספק ולהוסיף לפחות פריט אחד.');
      return;
    }

    setError('');
    setNotice('');
    setSaving(true);
    try {
      await apiRequest('/purchases', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          items,
          paymentMethod,
        }),
      });
      setPurchaseItems([]);
      setItemName('');
      setUnitPrice('');
      setQuantity('1');
      setNotice('הרכישה נשמרה.');
      setView('overview');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function addLineItem() {
    const parsedQuantity = Number(quantity);
    const parsedUnitPrice = Number(unitPrice);
    if (!itemName.trim() || unitPrice.trim() === '' || !Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0 || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('כדי להוסיף פריט, יש למלא שם, כמות ומחיר תקינים.');
      return;
    }
    setPurchaseItems((current) => [
      ...current,
      { name: itemName.trim(), quantity: parsedQuantity, unitPrice: parsedUnitPrice },
    ]);
    setItemName('');
    setQuantity('1');
    setUnitPrice('');
    setError('');
  }

  function applyCustomRange() {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(customFrom) || !datePattern.test(customTo)) {
      setError('יש להזין תאריכים בפורמט שנה-חודש-יום, לדוגמה 2026-05-21.');
      return;
    }
    function parseCalendarDate(value) {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
      }
      return date;
    }

    const from = parseCalendarDate(customFrom);
    const to = parseCalendarDate(customTo);
    if (!from || !to) {
      setError('אחד התאריכים אינו תקין.');
      return;
    }
    if (from > to) {
      setError('תאריך ההתחלה חייב להיות לפני תאריך הסיום.');
      return;
    }
    setError('');
    setPeriod('custom');
  }

  async function markPaid(purchaseId) {
    setError('');
    setSaving(true);
    try {
      await apiRequest(`/purchases/${purchaseId}/mark-paid`, { method: 'PATCH' });
      setNotice('הרכישה סומנה כשולמה.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function configureBiometricLogin() {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      if (biometricEnabled) {
        await disableBiometricLogin();
        onBiometricLoginChanged(false);
        setNotice('ההתחברות הביומטרית כובתה במכשיר הזה.');
      } else {
        const result = await enableBiometricLogin();
        if (result.enabled) {
          onBiometricLoginChanged(true);
          setNotice('ההתחברות הביומטרית הופעלה במכשיר הזה.');
        } else if (result.cancelled) {
          setNotice('הפעלת ההתחברות הביומטרית בוטלה.');
        } else {
          setError(result.message);
        }
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function registerPasskey() {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const options = await apiRequest('/auth/passkey/register/options', {
        method: 'POST',
      });
      const { startRegistration } = await import('@simplewebauthn/browser');
      const response = await startRegistration({ optionsJSON: options });
      await apiRequest('/auth/passkey/register/verify', {
        method: 'POST',
        body: JSON.stringify(response),
      });
      setNotice('ה־Passkey הוגדר. בפעם הבאה אפשר להתחבר באמצעות זיהוי המכשיר.');
    } catch (requestError) {
      setError(
        requestError.name === 'NotAllowedError'
          ? 'הגדרת ה־Passkey בוטלה או לא הושלמה.'
          : requestError.message,
      );
    } finally {
      setSaving(false);
    }
  }

  function purchasePartnerName(purchase) {
    const partner = isBusiness ? purchase.supplierId : purchase.businessId;
    return partner?.businessName || 'עסק';
  }

  function filterPurchasesByPeriod() {
    if (period === 'all') {
      return purchases;
    }

    let from;
    let to;
    if (period === 'custom') {
      const parseCalendarDate = (value) => {
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year &&
          date.getMonth() === month - 1 &&
          date.getDate() === day
          ? date
          : null;
      };
      from = parseCalendarDate(customFrom);
      to = parseCalendarDate(customTo);
      if (!from || !to) {
        return [];
      }
      to.setHours(23, 59, 59, 999);
    } else {
      from = new Date();
      from.setHours(0, 0, 0, 0);
      if (period === '7d') {
        from.setDate(from.getDate() - 7);
      } else if (period === '30d') {
        from.setDate(from.getDate() - 30);
      }
    }

    return purchases.filter((purchase) => {
      const createdAt = new Date(purchase.createdAt);
      return createdAt >= from && (!to || createdAt <= to);
    });
  }

  const historyPurchases = filterPurchasesByPeriod();
  const visiblePurchases = view === 'history' ? historyPurchases : purchases.slice(0, 5);
  const dashboardMenuItems = [
    { key: 'overview', label: 'סקירה כללית' },
    { key: 'history', label: isBusiness ? 'היסטוריית רכישות' : 'היסטוריית מכירות' },
    ...(isBusiness
      ? [
          { key: 'supplier', label: 'הוספת ספק' },
          { key: 'purchase', label: 'רכישה חדשה' },
        ]
      : []),
    { key: 'profile', label: 'פרופיל והגדרות' },
    { key: 'security', label: 'התחברות ואבטחה' },
  ];
  const purchaseList = loading ? (
    <ActivityIndicator color={colors.teal} style={styles.listLoader} />
  ) : visiblePurchases.length ? visiblePurchases.map((purchase) => (
    <View key={purchase._id} style={styles.purchaseRow}>
      <View style={styles.purchaseSummary}>
        <Text style={styles.purchaseName}>{purchasePartnerName(purchase)}</Text>
        <Text style={styles.purchaseMeta}>
          {purchase.items.map((item) => item.name).join(', ')} · {new Date(purchase.createdAt).toLocaleDateString('he-IL')}
        </Text>
        <Text style={styles.purchaseMeta}>
          {purchase.paymentMethod === 'cash' ? 'חשבון פתוח' : purchase.paymentMethod === 'check' ? 'צ׳ק' : 'אשראי'}
          {' · '}
          {purchase.paymentStatus === 'paid' ? 'שולם' : purchase.paymentStatus === 'open' ? 'פתוח' : 'ממתין לתשלום'}
        </Text>
      </View>
      <View style={styles.purchaseAmount}>
        <Text style={styles.purchaseValue}>{amount(purchase.totalAmount)}</Text>
        {isBusiness && purchase.paymentStatus !== 'paid' ? (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => markPaid(purchase._id)}
          >
            <Text style={styles.markPaidText}>סימון כשולם</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )) : (
    <Text style={styles.emptyState}>
      {isBusiness
        ? 'אין רכישות להצגה בתקופה שנבחרה.'
        : 'אין עסקאות להצגה בתקופה שנבחרה.'}
    </Text>
  );

  return (
    <View style={styles.dashboard}>
      <View style={styles.dashboardHeader}>
        <View style={styles.dashboardIdentity}>
          <View style={styles.dashboardGreetingBlock}>
            <Text style={styles.dashboardGreeting}>
              שלום, {user.contactName}
            </Text>
            <Text style={styles.dashboardBusiness}>{user.businessName}</Text>
          </View>
          <View style={styles.dashboardAvatar}>
            {user.profileImage ? (
              <Image source={{ uri: user.profileImage }} style={styles.dashboardAvatarImage} />
            ) : (
              <Text style={styles.dashboardAvatarFallback}>
                {user.contactName?.[0] || 'T'}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.dashboardHeaderActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="פתיחת תפריט ניווט"
            accessibilityState={{ expanded: menuOpen }}
            onPress={() => setMenuOpen(true)}
            style={styles.menuButton}
          >
            <Text style={styles.menuButtonIcon}>☰</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onLogout} disabled={busy}>
            <Text style={styles.logoutText}>{busy ? '...' : 'התנתקות'}</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
        transparent
        visible={menuOpen}
      >
        <View style={styles.menuOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="סגירת תפריט"
            onPress={() => setMenuOpen(false)}
            style={styles.menuScrim}
          />
          <View accessibilityViewIsModal style={styles.menuDrawer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>תפריט</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="סגירה"
                onPress={() => setMenuOpen(false)}
                style={styles.menuCloseButton}
              >
                <Text style={styles.menuCloseText}>×</Text>
              </Pressable>
            </View>
            <Text style={styles.menuAccountName}>
              {isBusiness ? 'ניהול העסק' : 'אזור הספק'}
            </Text>
            {dashboardMenuItems.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: view === item.key }}
                onPress={() => {
                  setView(item.key);
                  setMenuOpen(false);
                  setError('');
                  setNotice('');
                }}
                style={[
                  styles.menuItem,
                  view === item.key && styles.menuItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.menuItemText,
                    view === item.key && styles.menuItemTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>
            {isBusiness ? 'סה״כ רכישות' : 'סה״כ מכירות'}
          </Text>
          <Text style={styles.metricValue}>{amount(purchaseSummary.totalAmount)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>שולם</Text>
          <Text style={styles.metricValue}>{amount(purchaseSummary.paidAmount)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>
            {isBusiness ? 'יתרה פתוחה' : 'יתרה לגבייה'}
          </Text>
          <Text style={styles.metricValue}>{amount(purchaseSummary.openAmount)}</Text>
        </View>
      </View>

      {view === 'profile' ? (
        <ProfileSettings
          user={user}
          onProfileUpdated={onProfileUpdated}
        />
      ) : null}

      {view === 'security' ? (
        <View style={styles.loginMethodPanel}>
          <Text style={styles.panelTitle}>התחברות מהירה</Text>
          {Platform.OS === 'web' ? (
            <>
              <Text style={styles.formHint}>
                הגדירו Passkey פעם אחת כדי להתחבר באמצעות Face ID או אמצעי האימות של המכשיר, בלי להקליד שם משתמש.
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={registerPasskey}
                style={[styles.outlineButton, saving && styles.disabledButton]}
              >
                <Text style={styles.outlineButtonText}>
                  {saving ? 'מגדיר...' : 'הגדרת Passkey / Face ID'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.formHint}>
                ההתחברות הביומטרית נשמרת במכשיר הזה בלבד.
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={configureBiometricLogin}
                style={[styles.outlineButton, saving && styles.disabledButton]}
              >
                <Text style={styles.outlineButtonText}>
                  {saving
                    ? 'מעדכן...'
                    : biometricEnabled
                      ? 'כיבוי התחברות ביומטרית'
                      : 'הפעלת זיהוי פנים / טביעת אצבע'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      {view === 'supplier' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>הוספת ספק לחשבון</Text>
          <Text style={styles.cardSubtitle}>אפשר להוסיף ספק שכבר פתח חשבון TrixPay.</Text>
          <Text style={styles.fieldLabel}>דוא״ל הספק</Text>
          <TextInput
            accessibilityLabel="דוא״ל הספק"
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setSupplierEmail}
            placeholder="supplier@example.com"
            placeholderTextColor="#9AA8B5"
            style={styles.input}
            textAlign="right"
            value={supplierEmail}
          />
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={addSupplier}
            style={[styles.primaryButton, saving && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>{saving ? 'מוסיף...' : 'הוספת ספק'}</Text>
          </Pressable>
        </View>
      ) : null}

      {view === 'purchase' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>רישום רכישה</Text>
          <Text style={styles.cardSubtitle}>תעד/י את פרטי הסחורה ואופן התשלום שסוכם.</Text>
          <Text style={styles.fieldLabel}>ספק</Text>
          {partners.length ? (
            <View style={styles.partnerChoices}>
              {partners.map((partner) => {
                const id = partner._id || partner.id;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedSupplierId === id }}
                    onPress={() => setSelectedSupplierId(id)}
                    style={[styles.partnerChoice, selectedSupplierId === id && styles.selectedRole]}
                  >
                    <Text style={[styles.roleText, selectedSupplierId === id && styles.selectedRoleText]}>
                      {partner.businessName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.infoText}>כדי לרשום רכישה, יש להוסיף קודם ספק.</Text>
          )}
          <Text style={styles.fieldLabel}>שם הפריט</Text>
          <TextInput
            accessibilityLabel="שם הפריט"
            onChangeText={setItemName}
            placeholder="לדוגמה: פולי קפה"
            placeholderTextColor="#9AA8B5"
            style={styles.input}
            textAlign="right"
            value={itemName}
          />
          <View style={styles.purchaseFieldsRow}>
            <View style={styles.purchaseField}>
              <Text style={styles.fieldLabel}>כמות</Text>
              <TextInput
                accessibilityLabel="כמות"
                keyboardType="decimal-pad"
                onChangeText={setQuantity}
                style={styles.input}
                textAlign="right"
                value={quantity}
              />
            </View>
            <View style={styles.purchaseField}>
              <Text style={styles.fieldLabel}>מחיר ליחידה (₪)</Text>
              <TextInput
                accessibilityLabel="מחיר ליחידה"
                keyboardType="decimal-pad"
                onChangeText={setUnitPrice}
                placeholder="0.00"
                placeholderTextColor="#9AA8B5"
                style={styles.input}
                textAlign="right"
                value={unitPrice}
              />
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={addLineItem} style={styles.addItemButton}>
            <Text style={styles.addItemText}>+ הוספת פריט לרכישה</Text>
          </Pressable>
          {purchaseItems.length ? (
            <View style={styles.draftItems}>
              {purchaseItems.map((item, index) => (
                <View key={`${item.name}-${index}`} style={styles.draftItemRow}>
                  <Text style={styles.draftItemText}>
                    {item.name} · {item.quantity} × {amount(item.unitPrice)}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`הסרת ${item.name}`}
                    onPress={() => setPurchaseItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Text style={styles.removeItemText}>הסרה</Text>
                  </Pressable>
                </View>
              ))}
              <Text style={styles.draftTotal}>
                סה״כ ביניים: {amount(purchaseItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))}
              </Text>
            </View>
          ) : null}
          <Text style={styles.fieldLabel}>אופן תשלום</Text>
          <View style={styles.partnerChoices}>
            {[
              { key: 'cash', label: 'חשבון פתוח' },
              { key: 'check', label: 'צ׳ק' },
              { key: 'card', label: 'אשראי' },
            ].map((method) => (
              <Pressable
                key={method.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: paymentMethod === method.key }}
                onPress={() => setPaymentMethod(method.key)}
                style={[styles.partnerChoice, paymentMethod === method.key && styles.selectedRole]}
              >
                <Text style={[styles.roleText, paymentMethod === method.key && styles.selectedRoleText]}>
                  {method.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.paymentNotice}>
            זהו רישום למעקב בלבד. חיוב בכרטיס והפקת צ׳ק דיגיטלי ידרשו חיבור לספק תשלומים מורשה.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={saving || !partners.length}
            onPress={createPurchase}
            style={[styles.primaryButton, (saving || !partners.length) && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>{saving ? 'שומר...' : 'שמירת רכישה'}</Text>
          </Pressable>
        </View>
      ) : null}

      {view === 'overview' ? (
        <>
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>
                {isBusiness ? 'רכישות אחרונות' : 'מכירות אחרונות'}
              </Text>
              <Text style={styles.panelCount}>
                {Math.min(purchases.length, 5)} מתוך {purchases.length} רשומות
              </Text>
            </View>
            {purchaseList}
            {isBusiness && partners.length ? (
              <Text style={styles.dashboardHint}>
                רשומים {partners.length} ספקים לחשבון.
              </Text>
            ) : null}
          </View>
          {isBusiness ? (
            <Text style={styles.dashboardHint}>
              הסקירה מציגה את סך הרכישות, התשלומים והיתרה הפתוחה של העסק.
            </Text>
          ) : (
            <Text style={styles.dashboardHint}>
              הסקירה מציגה עסקאות מול עסקים ואת היתרה שטרם נגבתה.
            </Text>
          )}
        </>
      ) : null}

      {view === 'history' ? (
        <View style={styles.historyContent}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>
              {isBusiness ? 'היסטוריית רכישות' : 'היסטוריית מכירות'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {isBusiness
                ? 'סינון הרכישות לפי תקופה.'
                : 'סינון העסקאות מול הלקוחות לפי תקופה.'}
            </Text>
            <View style={styles.periodRow}>
              {[
                { key: 'today', label: 'היום' },
                { key: '7d', label: 'שבוע' },
                { key: '30d', label: 'חודש' },
                { key: 'all', label: 'הכל' },
              ].map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: period === item.key }}
                  onPress={() => setPeriod(item.key)}
                  style={[styles.periodButton, period === item.key && styles.periodButtonActive]}
                >
                  <Text style={[styles.periodText, period === item.key && styles.periodTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.customRange}>
              <TextInput
                accessibilityLabel="מתאריך"
                onChangeText={setCustomFrom}
                placeholder="מתאריך YYYY-MM-DD"
                placeholderTextColor="#9AA8B5"
                style={styles.dateInput}
                textAlign="right"
                value={customFrom}
              />
              <TextInput
                accessibilityLabel="עד תאריך"
                onChangeText={setCustomTo}
                placeholder="עד תאריך YYYY-MM-DD"
                placeholderTextColor="#9AA8B5"
                style={styles.dateInput}
                textAlign="right"
                value={customTo}
              />
              <Pressable
                accessibilityRole="button"
                onPress={applyCustomRange}
                style={[styles.periodButton, period === 'custom' && styles.periodButtonActive]}
              >
                <Text style={[styles.periodText, period === 'custom' && styles.periodTextActive]}>
                  סינון
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>
                {isBusiness ? 'רכישות בתקופה' : 'עסקאות בתקופה'}
              </Text>
              <Text style={styles.panelCount}>{historyPurchases.length} רשומות</Text>
            </View>
            {purchaseList}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 860;
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    contactName: '',
    businessName: '',
    username: '',
    email: '',
    identifier: '',
    password: '',
    confirmPassword: '',
    role: 'business',
  });
  const [user, setUser] = useState(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const splashStartedAt = Date.now();

    async function restoreSession() {
      try {
        const useBiometricLogin = await isBiometricLoginEnabled();
        if (active && useBiometricLogin) {
          setBiometricEnabled(true);
          return;
        }
        if (!(await hasAccessToken())) {
          return;
        }
        const result = await apiRequest('/auth/me');
        if (active) {
          setUser(result.user);
        }
      } catch (requestError) {
        if (requestError.status !== 401 && active) {
          setError(requestError.message);
        }
        if (requestError.status === 401) {
          await clearAccessToken();
        }
      } finally {
        const remainingSplashTime = Math.max(0, 800 - (Date.now() - splashStartedAt));
        if (remainingSplashTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingSplashTime));
        }
        if (active) {
          setBooting(false);
        }
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setError('');
    setNotice('');
  }

  async function submit() {
    setError('');
    setNotice('');

    if (mode === 'register') {
      if (form.password !== form.confirmPassword) {
        setError('הסיסמאות אינן תואמות.');
        return;
      }
      if (!form.contactName.trim() || !form.businessName.trim()) {
        setError('יש למלא שם מלא ושם עסק.');
        return;
      }
      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(form.username.trim())) {
        setError('שם המשתמש חייב להכיל 3–30 תווים באנגלית, מספרים, נקודה, מקף או קו תחתון.');
        return;
      }
    }
    if (form.password.length < 10) {
      setError('הסיסמה צריכה להכיל לפחות 10 תווים.');
      return;
    }

    setBusy(true);
    try {
      const path = mode === 'register' ? '/auth/register' : '/auth/login';
      const payload =
        mode === 'register'
          ? {
              contactName: form.contactName.trim(),
              businessName: form.businessName.trim(),
              role: form.role,
              username: form.username.trim(),
              email: form.email.trim(),
              password: form.password,
            }
          : { identifier: form.identifier.trim(), password: form.password };
      const result = await apiRequest(path, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await saveAccessToken(result.token);
      setUser(result.user);
      setForm((current) => ({
        ...current,
        password: '',
        confirmPassword: '',
      }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function loginWithBiometric() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const authenticated = await authenticateBiometricLogin();
      if (!authenticated) {
        setNotice('ההתחברות בוטלה. אפשר לנסות שוב או להתחבר עם שם משתמש וסיסמה.');
        return;
      }
      const result = await apiRequest('/auth/me');
      setUser(result.user);
    } catch (requestError) {
      if (requestError.status === 401) {
        await clearAccessToken();
        setBiometricEnabled(false);
      }
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function loginWithPasskey() {
    const identifier = form.identifier.trim();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const options = await apiRequest('/auth/passkey/login/options', {
        method: 'POST',
        body: JSON.stringify(identifier ? { identifier } : {}),
      });
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const response = await startAuthentication({ optionsJSON: options });
      const result = await apiRequest('/auth/passkey/login/verify', {
        method: 'POST',
        body: JSON.stringify(identifier ? { identifier, response } : { response }),
      });
      setUser(result.user);
    } catch (requestError) {
      setError(
        requestError.name === 'NotAllowedError'
          ? identifier
            ? 'ההתחברות עם Passkey בוטלה או לא הושלמה.'
            : 'לא נבחר Passkey. אם זו הפעם הראשונה, יש להתחבר עם סיסמה ולהגדיר Passkey בתפריט ״התחברות ואבטחה״.'
          : requestError.message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setError('');
    setBusy(true);
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
      await clearAccessToken();
      setBiometricEnabled(false);
      setUser(null);
      changeMode('login');
      setNotice('התנתקת בהצלחה.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function updateUserProfile(profileUpdates) {
    setUser((current) => current ? { ...current, ...profileUpdates } : current);
  }

  if (booting) {
    return <SplashScreen />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.page, user && styles.dashboardPage]}>
          <View style={[styles.mainContent, isWideScreen ? styles.wideContent : styles.mobileContent]}>
            {user ? (
              <Dashboard
                user={user}
                busy={busy}
                biometricEnabled={biometricEnabled}
                onBiometricLoginChanged={setBiometricEnabled}
                onLogout={logout}
                onProfileUpdated={updateUserProfile}
              />
            ) : (
              <>
                <View style={styles.authBrand}>
                  <BrandMark />
                </View>
                <View style={styles.card}>
                  <View style={styles.securityLabel}>
                    <View style={styles.securityIcon}>
                      <Text style={styles.securityIconText}>✓</Text>
                    </View>
                    <Text style={styles.securityLabelText}>כניסה מאובטחת</Text>
                  </View>

                  <Text style={styles.cardTitle}>
                    {mode === 'register' ? 'פתיחת חשבון' : 'טוב שחזרת'}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {mode === 'register'
                      ? 'יוצרים חשבון עסקי בכמה צעדים פשוטים.'
                      : 'היכנס לחשבון TrixPay שלך.'}
                  </Text>

                  <View style={styles.tabs}>
                    {[
                      { key: 'login', label: 'כניסה' },
                      { key: 'register', label: 'פתיחת חשבון' },
                    ].map((tab) => (
                      <Pressable
                        key={tab.key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: mode === tab.key }}
                        onPress={() => changeMode(tab.key)}
                        style={[styles.tab, mode === tab.key && styles.activeTab]}
                      >
                        <Text style={[styles.tabText, mode === tab.key && styles.activeTabText]}>
                          {tab.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {mode === 'register' ? (
                    <>
                      <Text style={styles.fieldLabel}>סוג החשבון</Text>
                      <View style={styles.roleRow}>
                        {[
                          { key: 'business', label: 'בעל/ת עסק' },
                          { key: 'supplier', label: 'ספק/ית' },
                        ].map((role) => (
                          <Pressable
                            key={role.key}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: form.role === role.key }}
                            onPress={() => updateField('role', role.key)}
                            style={[
                              styles.roleOption,
                              form.role === role.key && styles.selectedRole,
                            ]}
                          >
                            <Text
                              style={[
                                styles.roleText,
                                form.role === role.key && styles.selectedRoleText,
                              ]}
                            >
                              {role.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : null}

                  {inputFields
                    .filter((field) =>
                      mode === 'register'
                        ? field.key !== 'identifier'
                        : ['identifier', 'password'].includes(field.key),
                    )
                    .map((field) => (
                      <View key={field.key} style={styles.field}>
                        <Text style={styles.fieldLabel}>{field.label}</Text>
                        <TextInput
                          accessibilityLabel={field.label}
                          autoCapitalize={['email', 'username', 'identifier'].includes(field.key) ? 'none' : 'words'}
                          autoComplete={
                            field.key === 'email' || field.key === 'identifier'
                              ? field.key === 'email' ? 'email' : 'username'
                              : field.key === 'username'
                                ? 'username'
                              : field.key === 'password'
                                ? mode === 'register' ? 'new-password' : 'password'
                                : 'name'
                          }
                          keyboardType={field.keyboardType || 'default'}
                          onChangeText={(value) => updateField(field.key, value)}
                          placeholder={field.placeholder}
                          placeholderTextColor="#9AA8B5"
                          secureTextEntry={field.secureTextEntry}
                          style={styles.input}
                          textAlign="right"
                          value={form[field.key]}
                        />
                      </View>
                    ))}

                  {error ? (
                    <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
                  ) : null}
                  {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

                  {mode === 'login' && biometricEnabled ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={loginWithBiometric}
                      style={[styles.outlineButton, busy && styles.disabledButton]}
                    >
                      <Text style={styles.outlineButtonText}>
                        {busy ? 'מתחבר...' : 'כניסה באמצעות זיהוי פנים / טביעת אצבע'}
                      </Text>
                    </Pressable>
                  ) : null}

                  {mode === 'login' && Platform.OS === 'web' &&
                  typeof window !== 'undefined' &&
                  typeof window.PublicKeyCredential !== 'undefined' ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={loginWithPasskey}
                      style={[styles.outlineButton, busy && styles.disabledButton]}
                    >
                      <Text style={styles.outlineButtonText}>
                        {busy ? 'מתחבר...' : 'כניסה עם Passkey / זיהוי המכשיר'}
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={submit}
                    style={[styles.primaryButton, busy && styles.disabledButton]}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {mode === 'register' ? 'יצירת חשבון' : 'כניסה לחשבון'}
                      </Text>
                    )}
                  </Pressable>

                  <Text style={styles.footnote}>
                    פרטי ההתחברות משמשים לגישה לחשבון TrixPay שלך.
                  </Text>
                </View>
              </>
            )}
          </View>
          {!user ? (
            <Text style={styles.footer}>TrixPay · כל התשלומים העסקיים במקום אחד</Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  page: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingVertical: 28 },
  dashboardPage: { maxWidth: 1040 },
  mainContent: { alignItems: 'center' },
  wideContent: { flexDirection: 'column', gap: 20, width: '100%' },
  mobileContent: { flexDirection: 'column', gap: 18, width: '100%' },
  dashboard: { width: '100%', gap: 18 },
  dashboardHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.navy, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 20 },
  dashboardIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dashboardGreetingBlock: { alignItems: 'flex-end' },
  dashboardGreeting: { color: colors.white, fontSize: 20, fontWeight: '800', textAlign: 'right' },
  dashboardBusiness: { color: '#B7C9D3', fontSize: 13, marginTop: 5, textAlign: 'right' },
  dashboardAvatar: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', backgroundColor: '#DDF7F2', alignItems: 'center', justifyContent: 'center' },
  dashboardAvatarImage: { width: '100%', height: '100%' },
  dashboardAvatarFallback: { color: colors.navy, fontSize: 21, fontWeight: '800' },
  dashboardHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoutText: { color: '#C6D7DE', fontSize: 13, fontWeight: '700', padding: 8 },
  menuButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  menuButtonIcon: { color: colors.white, fontSize: 22, fontWeight: '700' },
  menuOverlay: { flex: 1, backgroundColor: 'transparent' },
  menuScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(9,27,42,0.5)' },
  menuDrawer: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '82%', maxWidth: 360, backgroundColor: colors.white, padding: 22, paddingTop: Platform.OS === 'web' ? 28 : 52, gap: 8, elevation: 12 },
  menuHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  menuTitle: { color: colors.navy, fontSize: 21, fontWeight: '800', textAlign: 'right' },
  menuCloseButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F2F6F8', alignItems: 'center', justifyContent: 'center' },
  menuCloseText: { color: colors.navy, fontSize: 26, lineHeight: 30 },
  menuAccountName: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'right', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 5 },
  menuItem: { minHeight: 48, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  menuItemActive: { backgroundColor: '#E9FAF7' },
  menuItemText: { color: colors.ink, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  menuItemTextActive: { color: '#087B6D', fontWeight: '800' },
  loginMethodPanel: { alignItems: 'flex-end', gap: 8, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: '#E6EDF1', padding: 22 },
  historyContent: { width: '100%', gap: 16 },
  panel: { backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: '#E6EDF1', padding: 22, shadowColor: '#20394B', shadowOpacity: 0.04, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  panelTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', textAlign: 'right' },
  panelHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  panelCount: { color: colors.muted, fontSize: 12 },
  periodRow: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  periodButton: { minWidth: 66, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 11, backgroundColor: '#E8EEF1' },
  periodButtonActive: { backgroundColor: '#DDF7F2' },
  periodText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  periodTextActive: { color: '#087B6D' },
  customRange: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dateInput: { flex: 1, minWidth: 140, height: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 10, color: colors.ink, fontSize: 11, backgroundColor: colors.white },
  metricsRow: { flexDirection: 'row-reverse', gap: 10 },
  metricCard: { flex: 1, minWidth: 100, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: '#E6EDF1', padding: 15 },
  metricLabel: { color: colors.muted, fontSize: 11, textAlign: 'right' },
  metricValue: { color: colors.navy, fontSize: 17, fontWeight: '800', textAlign: 'right', marginTop: 8 },
  purchaseRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 12, paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#EDF1F3' },
  purchaseSummary: { flex: 1, alignItems: 'flex-end' },
  purchaseName: { color: colors.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  purchaseMeta: { color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'right', marginTop: 3 },
  purchaseAmount: { alignItems: 'flex-start', justifyContent: 'center' },
  purchaseValue: { color: colors.navy, fontSize: 14, fontWeight: '800' },
  markPaidText: { color: '#078A78', fontSize: 11, fontWeight: '700', marginTop: 5 },
  emptyState: { color: colors.muted, fontSize: 13, lineHeight: 21, textAlign: 'right', paddingVertical: 18 },
  listLoader: { paddingVertical: 24 },
  dashboardHint: { color: colors.muted, fontSize: 12, textAlign: 'right', paddingHorizontal: 4 },
  profileContent: { width: '100%', gap: 16 },
  profileHeading: { alignItems: 'flex-end' },
  profileLoading: { paddingVertical: 60 },
  avatarRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 16, marginTop: 16 },
  avatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#E9F2F4', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { color: colors.navy, fontSize: 28, fontWeight: '800' },
  avatarActions: { flex: 1, alignItems: 'flex-end' },
  outlineButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: colors.border },
  outlineButtonText: { color: colors.navy, fontSize: 12, fontWeight: '700' },
  removePhotoText: { color: colors.danger, fontSize: 11, fontWeight: '600', paddingVertical: 8 },
  readOnlyInput: { backgroundColor: '#F1F4F5', color: colors.muted },
  editNameButton: { alignSelf: 'flex-end', paddingVertical: 10 },
  editNameText: { color: '#078A78', fontSize: 12, fontWeight: '700' },
  nameEditHint: { color: colors.muted, fontSize: 11, textAlign: 'right', marginTop: 7 },
  spacedLabel: { marginTop: 14 },
  formHint: { color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'right', marginTop: 12 },
  savedBankText: { color: '#087B6D', backgroundColor: '#E9FAF7', fontSize: 12, lineHeight: 19, textAlign: 'right', padding: 11, borderRadius: 10, marginVertical: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9,27,42,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmModal: { width: '100%', maxWidth: 440, backgroundColor: colors.white, borderRadius: 22, padding: 24 },
  modalTitle: { color: colors.navy, fontSize: 19, fontWeight: '800', textAlign: 'right' },
  modalText: { color: colors.ink, fontSize: 14, lineHeight: 23, textAlign: 'right', marginTop: 13 },
  confirmRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 17 },
  confirmText: { flex: 1, color: colors.ink, fontSize: 12, textAlign: 'right' },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderColor: colors.border, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.teal, borderColor: colors.teal },
  checkboxCheck: { color: colors.navy, fontSize: 14, fontWeight: '900' },
  cancelModalButton: { alignItems: 'center', paddingVertical: 13 },
  partnerChoices: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  partnerChoice: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FAFCFD' },
  purchaseFieldsRow: { flexDirection: 'row-reverse', gap: 12 },
  purchaseField: { flex: 1 },
  addItemButton: { alignSelf: 'flex-end', paddingVertical: 9, paddingHorizontal: 2 },
  addItemText: { color: '#078A78', fontSize: 13, fontWeight: '700' },
  draftItems: { backgroundColor: '#F6F9FA', borderRadius: 12, padding: 12, marginBottom: 15 },
  draftItemRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  draftItemText: { flex: 1, color: colors.ink, fontSize: 12, textAlign: 'right' },
  removeItemText: { color: colors.danger, fontSize: 11, fontWeight: '700', paddingHorizontal: 8 },
  draftTotal: { color: colors.navy, fontSize: 13, fontWeight: '800', textAlign: 'right', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9, marginTop: 5 },
  paymentNotice: { color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'right', marginTop: 2, marginBottom: 10 },
  authBrand: { marginBottom: 2 },
  brandRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 11 },
  logo: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.navy, fontSize: 24, fontWeight: '900' },
  brandName: { color: colors.navy, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  brandAccent: { color: colors.teal },
  splashScreen: { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  splashBrand: { alignItems: 'center', gap: 15 },
  splashLogo: { width: 74, height: 74, borderRadius: 24, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  splashLogoText: { color: colors.navy, fontSize: 43, fontWeight: '900' },
  splashBrandName: { color: colors.white, fontSize: 30, fontWeight: '800', letterSpacing: -0.7 },
  splashIndicator: { position: 'absolute', bottom: 56 },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 30,
    borderWidth: 1,
    borderColor: '#E6EDF1',
    shadowColor: '#20394B',
    shadowOpacity: 0.08,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  tabs: { flexDirection: 'row-reverse', backgroundColor: '#F2F6F8', borderRadius: 14, padding: 4, marginBottom: 28 },
  tab: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 11 },
  activeTab: { backgroundColor: colors.white, shadowColor: '#10283F', shadowOpacity: 0.08, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  tabText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  activeTabText: { color: colors.navy },
  securityLabel: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, alignSelf: 'flex-end', marginBottom: 16 },
  securityIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: '#E9FAF7', alignItems: 'center', justifyContent: 'center' },
  securityIconText: { color: '#078A78', fontSize: 13, fontWeight: '800' },
  securityLabelText: { color: '#55716F', fontSize: 12, fontWeight: '700' },
  cardTitle: { color: colors.ink, fontSize: 25, fontWeight: '800', textAlign: 'right', letterSpacing: -0.4 },
  cardSubtitle: { color: colors.muted, fontSize: 14, lineHeight: 23, marginTop: 8, marginBottom: 23, textAlign: 'right' },
  field: { marginBottom: 17 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '700', textAlign: 'right', marginBottom: 8 },
  input: { height: 53, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 15, color: colors.ink, fontSize: 14, backgroundColor: '#FAFCFD' },
  roleRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 21 },
  roleOption: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFCFD' },
  selectedRole: { backgroundColor: '#E9FAF7', borderColor: colors.teal },
  roleText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  selectedRoleText: { color: colors.navy, fontWeight: '700' },
  primaryButton: { height: 54, borderRadius: 13, backgroundColor: colors.navy, justifyContent: 'center', alignItems: 'center', marginTop: 7 },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  secondaryButton: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 25 },
  secondaryButtonText: { color: colors.navy, fontSize: 14, fontWeight: '700' },
  disabledButton: { opacity: 0.6 },
  errorText: { color: colors.danger, fontSize: 13, textAlign: 'right', lineHeight: 20, marginBottom: 8, backgroundColor: '#FFF4F2', padding: 10, borderRadius: 10 },
  noticeText: { color: '#067647', fontSize: 13, textAlign: 'right', marginBottom: 8 },
  footnote: { color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 18 },
  footer: { alignSelf: 'center', color: '#93A3AD', fontSize: 11, marginTop: 20 },
  welcomePanel: { alignItems: 'center', paddingVertical: 20 },
  welcomeIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#E9FAF7', alignItems: 'center', justifyContent: 'center', marginBottom: 19 },
  welcomeIconText: { color: colors.teal, fontSize: 26, fontWeight: '800' },
  infoText: { color: colors.muted, fontSize: 14, lineHeight: 23, textAlign: 'center', marginTop: 19 },
});
