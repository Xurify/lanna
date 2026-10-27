import { BookOpenTextIcon, CoffeeIcon, DoorOpenIcon, GiftIcon, HandshakeIcon, HistoryIcon, MapPinIcon, PaletteIcon, UserRoundIcon, UsersIcon, type LucideProps } from "lucide-react";

/** The path's unit icons, by the name UNITS[].glyph carries. A picture of
 *  what the unit is about (a coffee for "what you drink", a pin for
 *  "where?") instead of an ending like "-u", which reads as noise before
 *  the unit is learned. */
const ICONS = {
	book: BookOpenTextIcon,
	users: UsersIcon,
	coffee: CoffeeIcon,
	"map-pin": MapPinIcon,
	"user-round": UserRoundIcon,
	"door-open": DoorOpenIcon,
	handshake: HandshakeIcon,
	palette: PaletteIcon,
	history: HistoryIcon,
	gift: GiftIcon,
} as const;

export function UnitIcon({ name, ...props }: { name: string } & LucideProps) {
	const Icon = ICONS[name as keyof typeof ICONS] ?? BookOpenTextIcon;
	return <Icon aria-hidden="true" {...props} />;
}
