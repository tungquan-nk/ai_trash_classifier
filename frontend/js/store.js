/**
 * EcoSort AI - Central Store & Data Management
 * Quản lý trạng thái, dữ liệu người dùng, lịch sử phân loại rác và tính toán tiết kiệm
 */

(function (window) {
    'use strict';

    // ─── KEYS CHO LOCAL STORAGE ───
    const STORAGE_KEYS = {
        USER: 'ecosort_user_v2',
        HISTORY: 'ecosort_history_v2',
        SETTINGS: 'ecosort_settings_v2'
    };

    // ─── 6 LỚP PHÂN LOẠI CHUẨN CỦA MÔ HÌNH RESNET18 ───
    const WASTE_CLASSES = {
        plastic: {
            id: 'plastic',
            name: 'Chai nhựa / Đồ nhựa',
            enName: 'Plastic Bottle',
            icon: '🧴',
            recyclable: true,
            canSell: true,
            avgPrice: 500, // 500 đ / món (hoặc ~8.000 đ/kg)
            priceUnit: 'đ/chai',
            co2Grams: 45, // 45g CO2 tiết kiệm
            points: 2,
            bagColor: 'Túi xanh lá (Tái chế)',
            guideline: 'Súc sạch cặn nước bên trong, tháo nắp nhựa và đè bẹp để tiết kiệm diện tích túi chứa. Có thể bán ve chai hoặc gom vào túi xanh.',
            badgeClass: 'badge-plastic'
        },
        metal: {
            id: 'metal',
            name: 'Kim loại / Lon nhôm',
            enName: 'Metal Can',
            icon: '🥫',
            recyclable: true,
            canSell: true,
            avgPrice: 1200, // 1.200 đ / lon (~22.000 đ/kg)
            priceUnit: 'đ/lon',
            co2Grams: 160, // 160g CO2 tiết kiệm
            points: 5,
            bagColor: 'Túi xanh lá (Tái chế)',
            guideline: 'Rửa sạch vết nước ngọt hoặc dầu mỡ, dẫm bẹp vỏ lon. Lon nhôm là phế liệu có giá trị thu mua cao nhất tại vựa ve chai.',
            badgeClass: 'badge-metal'
        },
        cardboard: {
            id: 'cardboard',
            name: 'Bìa carton / Thùng giấy',
            enName: 'Cardboard Box',
            icon: '📦',
            recyclable: true,
            canSell: true,
            avgPrice: 1500, // 1.500 đ / hộp vừa (~2.500 đ/kg)
            priceUnit: 'đ/hộp',
            co2Grams: 110,
            points: 3,
            bagColor: 'Túi xanh lá (Tái chế)',
            guideline: 'Tháo bỏ băng keo dính và ghim kim loại bấm, gập phẳng hộp. Giữ khô ráo, không để dính nước hoặc dầu mỡ.',
            badgeClass: 'badge-cardboard'
        },
        paper: {
            id: 'paper',
            name: 'Giấy / Sách báo cũ',
            enName: 'Paper & Books',
            icon: '📰',
            recyclable: true,
            canSell: true,
            avgPrice: 800, // 800 đ / xấp (~3.000 đ/kg)
            priceUnit: 'đ/tập',
            co2Grams: 75,
            points: 2,
            bagColor: 'Túi xanh lá (Tái chế)',
            guideline: 'Gom thành từng xấp buộc dây gọn gàng. Giữ giấy luôn khô sạch, không lẫn giấy dính thức ăn hoặc bẩn.',
            badgeClass: 'badge-paper'
        },
        glass: {
            id: 'glass',
            name: 'Thủy tinh / Chai lọ',
            enName: 'Glass Bottle',
            icon: '🍾',
            recyclable: true,
            canSell: true,
            avgPrice: 600, // 600 đ / chai
            priceUnit: 'đ/chai',
            co2Grams: 85,
            points: 2,
            bagColor: 'Thùng thu gom riêng',
            guideline: 'Rửa sạch lòng chai lọ, tháo nắp. Xếp nhẹ nhàng tránh va đập vỡ gây nguy hiểm cho người thu gom phế liệu.',
            badgeClass: 'badge-glass'
        },
        trash: {
            id: 'trash',
            name: 'Rác sinh hoạt vô cơ',
            enName: 'General Waste',
            icon: '🗑️',
            recyclable: false,
            canSell: false,
            avgPrice: 0,
            priceUnit: 'không thu mua',
            co2Grams: 0,
            points: 1, // Điểm phân loại đúng nơi
            bagColor: 'Thùng rác vô cơ (Màu xám/vàng)',
            guideline: 'Rác hỗn hợp, túi nilon dính mỡ bẩn, hộp xốp dùng một lần không có giá trị tái chế. Cho vào thùng rác thông thường.',
            badgeClass: 'badge-trash'
        }
    };

    // ─── DỮ LIỆU MẪU MẶC ĐỊNH (PHÙ HỢP GIAO DIỆN MẪU: Liam Roderk, 800g CO2, 652 điểm, 165 rác) ───
    const DEFAULT_USER = {
        id: 'usr_liam_roderk',
        name: 'Liam Roderk',
        email: 'liam.roderk@ecosort.vn',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=180&q=80',
        badge: 'Eco Champion 🌿',
        level: 4,
        points: 652,
        co2Saved: 800, // 800g CO2
        itemsRecycled: 165,
        totalSavings: 245000, // 245.000 VNĐ
        isLoggedIn: true,
        joinDate: '2026-09-15'
    };

    // Mẫu các phiên phân loại demo phong phú
    function generateSeedHistory() {
        const now = new Date();
        const items = [
            {
                id: 'ECO-10028',
                name: 'Chai nước khoáng tinh khiết Aquafina 500ml',
                type: 'plastic',
                confidence: 98.4,
                recyclable: true,
                canSell: true,
                value: 500,
                co2: 45,
                points: 2,
                image: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&w=300&q=80',
                date: '2026-11-09 14:15',
                day: 20,
                month: 'June',
                status: 'saved'
            },
            {
                id: 'ECO-10027',
                name: 'Lon nước ngọt Coca-Cola nhôm 330ml',
                type: 'metal',
                confidence: 99.2,
                recyclable: true,
                canSell: true,
                value: 1200,
                co2: 160,
                points: 5,
                image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=300&q=80',
                date: '2026-11-09 11:20',
                day: 20,
                month: 'June',
                status: 'saved'
            },
            {
                id: 'ECO-10026',
                name: 'Thùng carton đựng hàng bưu kiện',
                type: 'cardboard',
                confidence: 96.7,
                recyclable: true,
                canSell: true,
                value: 1500,
                co2: 110,
                points: 3,
                image: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=300&q=80',
                date: '2026-11-08 16:40',
                day: 19,
                month: 'June',
                status: 'saved'
            },
            {
                id: 'ECO-10025',
                name: 'Cốc nhựa takeaway uống cà phê',
                type: 'plastic',
                confidence: 94.8,
                recyclable: true,
                canSell: true,
                value: 400,
                co2: 40,
                points: 2,
                image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=300&q=80',
                date: '2026-11-08 09:15',
                day: 19,
                month: 'June',
                status: 'saved'
            },
            {
                id: 'ECO-10024',
                name: 'Chai rượu vang thủy tinh xanh',
                type: 'glass',
                confidence: 97.5,
                recyclable: true,
                canSell: true,
                value: 600,
                co2: 85,
                points: 2,
                image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=300&q=80',
                date: '2026-11-07 19:30',
                day: 18,
                month: 'June',
                status: 'saved'
            },
            {
                id: 'ECO-10023',
                name: 'Tập báo giấy cũ và tạp chí',
                type: 'paper',
                confidence: 98.1,
                recyclable: true,
                canSell: true,
                value: 1000,
                co2: 75,
                points: 2,
                image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=300&q=80',
                date: '2026-11-07 14:05',
                day: 18,
                month: 'June',
                status: 'saved'
            },
            {
                id: 'ECO-10022',
                name: 'Túi nilon thực phẩm dính dầu mỡ',
                type: 'trash',
                confidence: 95.3,
                recyclable: false,
                canSell: false,
                value: 0,
                co2: 0,
                points: 1,
                image: 'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=300&q=80',
                date: '2026-11-06 18:20',
                day: 17,
                month: 'June',
                status: 'discarded'
            },
            {
                id: 'ECO-10021',
                name: 'Lon bia lon nhôm Tiger',
                type: 'metal',
                confidence: 99.5,
                recyclable: true,
                canSell: true,
                value: 1200,
                co2: 160,
                points: 5,
                image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80',
                date: '2026-11-06 12:45',
                day: 17,
                month: 'June',
                status: 'saved'
            },
            {
                id: 'ECO-10020',
                name: 'Hộp sữa tươi giấy tiệt trùng',
                type: 'cardboard',
                confidence: 93.8,
                recyclable: true,
                canSell: true,
                value: 500,
                co2: 50,
                points: 2,
                image: 'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?auto=format&fit=crop&w=300&q=80',
                date: '2026-11-05 08:30',
                day: 16,
                month: 'June',
                status: 'saved'
            },
            {
                id: 'ECO-10019',
                name: 'Chai nước khoáng thể thao rỗng',
                type: 'plastic',
                confidence: 97.9,
                recyclable: true,
                canSell: true,
                value: 500,
                co2: 45,
                points: 2,
                image: 'https://images.unsplash.com/photo-1603555501671-8f96b3fce8e4?auto=format&fit=crop&w=300&q=80',
                date: '2026-11-04 15:10',
                day: 15,
                month: 'June',
                status: 'saved'
            }
        ];
        return items;
    }

    // ─── LỚP QUẢN LÝ STORE ───
    const EcoStore = {
        classes: WASTE_CLASSES,

        // 1. NGƯỜI DÙNG & TÀI KHOẢN (Usecase 3)
        getUser: function () {
            try {
                const data = localStorage.getItem(STORAGE_KEYS.USER);
                if (!data) {
                    // Mặc định lưu tài khoản demo Liam Roderk
                    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(DEFAULT_USER));
                    return Object.assign({}, DEFAULT_USER);
                }
                return JSON.parse(data);
            } catch (e) {
                return Object.assign({}, DEFAULT_USER);
            }
        },

        saveUser: function (user) {
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
            this.notifyListeners('user', user);
        },

        isGuest: function () {
            const user = this.getUser();
            return !user || !user.isLoggedIn;
        },

        setGuestMode: function () {
            const guestUser = {
                id: 'guest_' + Date.now(),
                name: 'Khách vãng lai',
                email: '',
                avatar: '',
                badge: 'Khách khám phá 🌱',
                level: 1,
                points: 0,
                co2Saved: 0,
                itemsRecycled: 0,
                totalSavings: 0,
                isLoggedIn: false
            };
            this.saveUser(guestUser);
            return guestUser;
        },

        loginDemoUser: function () {
            this.saveUser(DEFAULT_USER);
            return DEFAULT_USER;
        },

        logout: function () {
            return this.setGuestMode();
        },

        // 2. LỊCH SỬ PHÂN LOẠI (Usecase 7, 8, 13)
        getHistory: function () {
            try {
                const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
                if (!data) {
                    const seed = generateSeedHistory();
                    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(seed));
                    return seed;
                }
                return JSON.parse(data);
            } catch (e) {
                return generateSeedHistory();
            }
        },

        saveHistory: function (items) {
            localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(items));
            this.notifyListeners('history', items);
        },

        addSession: function (sessionData) {
            const history = this.getHistory();
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

            const classInfo = WASTE_CLASSES[sessionData.type] || WASTE_CLASSES.trash;

            const newItem = {
                id: 'ECO-' + Math.floor(10000 + Math.random() * 90000),
                name: sessionData.name || classInfo.name,
                type: sessionData.type,
                confidence: sessionData.confidence || 98.0,
                recyclable: classInfo.recyclable,
                canSell: classInfo.canSell,
                value: sessionData.value !== undefined ? sessionData.value : classInfo.avgPrice,
                co2: sessionData.co2 !== undefined ? sessionData.co2 : classInfo.co2Grams,
                points: sessionData.points !== undefined ? sessionData.points : classInfo.points,
                image: sessionData.image || '',
                date: dateStr,
                day: now.getDate(),
                month: 'June',
                status: 'saved',
                notes: sessionData.notes || ''
            };

            history.unshift(newItem);
            this.saveHistory(history);

            // Cập nhật người dùng nếu đã đăng nhập hoặc lưu tạm
            const user = this.getUser();
            if (user) {
                user.points = (user.points || 0) + newItem.points;
                user.co2Saved = (user.co2Saved || 0) + newItem.co2;
                if (newItem.recyclable) {
                    user.itemsRecycled = (user.itemsRecycled || 0) + 1;
                    user.totalSavings = (user.totalSavings || 0) + newItem.value;
                }
                this.saveUser(user);
            }

            return newItem;
        },

        deleteSession: function (id) {
            let history = this.getHistory();
            history = history.filter(item => item.id !== id);
            this.saveHistory(history);
            return history;
        },

        clearAllHistory: function () {
            localStorage.removeItem(STORAGE_KEYS.HISTORY);
            return this.getHistory();
        },

        // 3. TÍNH TOÁN TIỀN TIẾT KIỆM THEO KỲ (Usecase 9)
        // Hỗ trợ 4 kỳ: 'week' (Tuần), 'month' (Tháng), 'year' (Năm), 'all' (Từ đầu)
        calculateSavingsByPeriod: function (period) {
            const history = this.getHistory();
            const now = new Date();

            let filtered = [];

            if (period === 'week') {
                // Trong vòng 7 ngày gần nhất
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                filtered = history.filter(item => {
                    const d = new Date(item.date.replace(' ', 'T'));
                    return isNaN(d) || d >= sevenDaysAgo;
                });
            } else if (period === 'month') {
                // Trong vòng 30 ngày gần nhất
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                filtered = history.filter(item => {
                    const d = new Date(item.date.replace(' ', 'T'));
                    return isNaN(d) || d >= thirtyDaysAgo;
                });
            } else if (period === 'year') {
                // Trong năm 2026
                filtered = history.filter(item => {
                    const d = new Date(item.date.replace(' ', 'T'));
                    return isNaN(d) || d.getFullYear() === now.getFullYear();
                });
            } else {
                // 'all' - Tất cả
                filtered = history;
            }

            // Tính tổng
            let totalSavings = 0;
            let totalCO2 = 0;
            let totalPoints = 0;
            let recyclableCount = 0;
            let nonRecyclableCount = 0;

            const breakdown = {
                plastic: { count: 0, savings: 0, co2: 0, name: 'Nhựa', icon: '🧴' },
                metal: { count: 0, savings: 0, co2: 0, name: 'Kim loại', icon: '🥫' },
                cardboard: { count: 0, savings: 0, co2: 0, name: 'Carton', icon: '📦' },
                paper: { count: 0, savings: 0, co2: 0, name: 'Giấy', icon: '📰' },
                glass: { count: 0, savings: 0, co2: 0, name: 'Thủy tinh', icon: '🍾' },
                trash: { count: 0, savings: 0, co2: 0, name: 'Rác khác', icon: '🗑️' }
            };

            filtered.forEach(item => {
                const val = item.value || 0;
                const co2 = item.co2 || 0;
                const pts = item.points || 0;

                totalPoints += pts;

                if (item.recyclable) {
                    totalSavings += val;
                    totalCO2 += co2;
                    recyclableCount++;
                } else {
                    nonRecyclableCount++;
                }

                const cat = breakdown[item.type] || breakdown.trash;
                cat.count++;
                cat.savings += val;
                cat.co2 += co2;
            });

            // Nếu người dùng có số liệu tổng lớn hơn ở hồ sơ mặc định Liam Roderk (ví dụ 165 món, 245.000đ),
            // điều chỉnh hệ số cân đối cho kỳ 'all' hoặc 'year' để số liệu hiển thị thực tế đồng nhất với mockup
            const user = this.getUser();
            if (period === 'all' && user && user.totalSavings > totalSavings) {
                totalSavings = user.totalSavings;
                totalCO2 = user.co2Saved || totalCO2;
                recyclableCount = user.itemsRecycled || recyclableCount;
            }

            return {
                period: period,
                totalSavings: totalSavings,
                formattedSavings: totalSavings.toLocaleString('vi-VN') + ' đ',
                totalCO2: totalCO2,
                formattedCO2: totalCO2 >= 1000 ? (totalCO2 / 1000).toFixed(1) + 'kg' : totalCO2 + 'g',
                totalPoints: totalPoints,
                totalItems: filtered.length,
                recyclableCount: recyclableCount,
                nonRecyclableCount: nonRecyclableCount,
                breakdown: breakdown,
                items: filtered
            };
        },

        // 4. BỘ PHÁT SỰ KIỆN (EVENT LISTENERS)
        listeners: [],
        subscribe: function (fn) {
            this.listeners.push(fn);
        },
        notifyListeners: function (type, data) {
            this.listeners.forEach(fn => {
                try { fn(type, data); } catch (e) { console.error(e); }
            });
        },

        // 5. HELPER FORMAT
        formatMoney: function (amount) {
            return (amount || 0).toLocaleString('vi-VN') + ' đ';
        }
    };

    window.EcoStore = EcoStore;

})(window);
