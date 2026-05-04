# واجهة الشات للمتجر الإلكتروني

## تغيير الثيم (Theme)

لتغيير ثيم الشات، قم بتعديل الـ `currentTheme` في ملف `/src/app/components/ChatWidget.tsx`:

```tsx
const [currentTheme, setCurrentTheme] = useState<Theme>(THEMES[0]);
```

### الثيمات المتاحة:

- `THEMES[0]` - أبيض كلاسيكي (#FFFFFF)
- `THEMES[1]` - أسود أنيق (#000000)
- `THEMES[2]` - ذهبي فاخر (#FFD700)
- `THEMES[3]` - أزرق سماوي (#00BFFF)
- `THEMES[4]` - أزرق داكن (#0A1F44)
- `THEMES[5]` - أحمر قوي (#FF0000)
- `THEMES[6]` - واتساب (#25D366)

مثال:
```tsx
// لاستخدام ثيم واتساب
const [currentTheme, setCurrentTheme] = useState<Theme>(THEMES[6]);
```

## ملاحظات:
- منطقة المحادثات تبقى بيضاء في جميع الثيمات
- الثيم يؤثر فقط على الهيدر وألوان أزرار الإرسال ورسائل المتجر
