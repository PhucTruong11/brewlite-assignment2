import { MapPin, Phone, Mail, Clock } from 'lucide-react';

const SHOP = {
    name: 'BrewLite',
    slogan: 'BrewLite cung cấp giải pháp đặt hàng và thanh toán trực tuyến liền mạch, mang đến trải nghiệm thưởng thức cà phê tối ưu cho người dùng hiện đại.',
    address: '273 An Dương Vương, Phường Chợ Quán, TP. Hồ Chí Minh',
    hotline: '1900 6868',
    email: 'support@brewlite.vn',
    hours: '07:00 – 22:00, mở cửa hằng ngày',
};

// Link chỉ đường: Google Maps tự tìm theo địa chỉ, không cần API key
const MAP_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SHOP.address)}`;

export function Footer() {
    return (
        <footer className="mt-8 bg-primary px-4 pb-6 pt-10 text-white lg:px-8">
            <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2">
                <div>
                    <p className="text-2xl font-extrabold text-background">{SHOP.name}</p>
                    <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/75">
                        {SHOP.slogan}
                    </p>
                </div>

                <div>
                    <p className="mb-3 text-sm font-bold uppercase tracking-wider text-white">
                        Liên hệ
                    </p>
                    <ul className="flex flex-col gap-3 text-sm text-white/75">
                        <li className="flex items-start gap-2.5">
                            <MapPin size={16} className="mt-0.5 shrink-0 text-white" />
                            <span>{SHOP.address}</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                            <Phone size={16} className="shrink-0 text-white" />
                            <a href={`tel:${SHOP.hotline.replace(/\s/g, '')}`} className="hover:text-white hover:underline">
                                {SHOP.hotline}
                            </a>
                        </li>
                        <li className="flex items-center gap-2.5">
                            <Mail size={16} className="shrink-0 text-white" />
                            <a href={`mailto:${SHOP.email}`} className="hover:text-white hover:underline">
                                {SHOP.email}
                            </a>
                        </li>
                        <li className="flex items-center gap-2.5">
                            <Clock size={16} className="shrink-0 text-white" />
                            <span>{SHOP.hours}</span>
                        </li>
                    </ul>

                    <a
                        href={MAP_URL}
                        target="_blank"
                        rel="noopener noreferrer" // bảo mật khi mở tab mới
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-background"
                    >
                        <MapPin size={14} /> Chỉ đường
                    </a>
                </div>
            </div>

            <p className="mx-auto mt-8 max-w-5xl border-t border-white/15 pt-4 text-center text-xs text-white/50">
                © {new Date().getFullYear()} {SHOP.name}. Bài tập lớn môn Công nghệ Phần mềm.
            </p>
        </footer>
    );
}