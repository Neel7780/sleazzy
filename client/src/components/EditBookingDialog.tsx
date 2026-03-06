import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from './ui/select';
import { apiRequest, ApiVenue } from '../lib/api';
import { GroupedBooking } from '../types';
import { Trash2, Loader2, MapPin } from 'lucide-react';
import { Badge } from './ui/badge';

type Props = {
    booking: GroupedBooking | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
    onDeleted: () => void;
};

const EVENT_TYPES = [
    { value: 'co_curricular', label: 'Co-Curricular' },
    { value: 'open_all', label: 'Open for All' },
    { value: 'closed_club', label: 'Closed Club' },
];

const STATUSES = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
];

const EditBookingDialog: React.FC<Props> = ({
    booking,
    open,
    onOpenChange,
    onSaved,
    onDeleted,
}) => {
    const [eventName, setEventName] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [eventType, setEventType] = useState('');
    const [expectedAttendees, setExpectedAttendees] = useState('');
    const [status, setStatus] = useState('');
    const [isPublic, setIsPublic] = useState(false);

    // Multi-venue state: set of currently selected venue IDs for this group
    const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);

    const [venues, setVenues] = useState<ApiVenue[]>([]);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load venues list
    useEffect(() => {
        apiRequest<ApiVenue[]>('/api/venues')
            .then(setVenues)
            .catch(() => setVenues([]));
    }, []);

    // Populate form from booking
    useEffect(() => {
        if (booking) {
            setEventName(booking.eventName);
            setSelectedVenueIds(booking.venueIds || []);
            setEventType(booking.eventType || '');
            setExpectedAttendees(
                booking.expectedAttendees ? String(booking.expectedAttendees) : ''
            );
            setStatus(booking.status);
            setIsPublic(booking.isPublic ?? false);
            setConfirmDelete(false);
            setError(null);

            setStartTime(toDatetimeLocal(booking.date, booking.startTime));
            setEndTime(toDatetimeLocal(booking.date, booking.endTime));
        }
    }, [booking]);

    const toDatetimeLocal = (isoDate: string, timeStr: string): string => {
        const date = new Date(isoDate);
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);

        if (modifier === 'PM' && hours !== 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const h = String(hours).padStart(2, '0');
        const m = String(minutes).padStart(2, '0');

        return `${year}-${month}-${day}T${h}:${m}`;
    };

    const toggleVenue = (venueId: string) => {
        setSelectedVenueIds(prev =>
            prev.includes(venueId)
                ? prev.filter(id => id !== venueId)
                : [...prev, venueId]
        );
    };

    const handleSave = async () => {
        if (!booking) return;
        if (selectedVenueIds.length === 0) {
            setError('At least one venue must be selected.');
            return;
        }

        setSaving(true);
        setError(null);

        const sharedFields = {
            event_name: eventName,
            start_time: new Date(startTime).toISOString(),
            end_time: new Date(endTime).toISOString(),
            event_type: eventType || undefined,
            expected_attendees: expectedAttendees ? parseInt(expectedAttendees) : undefined,
            status,
            is_public: isPublic,
        };

        try {
            const originalIds = booking.ids;
            const originalVenueIds = booking.venueIds;

            // Determine which bookings are kept vs removed, and which venues are new
            const keptIds = originalIds.filter((_, i) => selectedVenueIds.includes(originalVenueIds[i]));
            const removedIds = originalIds.filter((_, i) => !selectedVenueIds.includes(originalVenueIds[i]));
            const addedVenueIds = selectedVenueIds.filter(vid => !originalVenueIds.includes(vid));

            // 1. Update all kept bookings with the new shared field values
            await Promise.all(keptIds.map(id =>
                apiRequest(`/api/admin/bookings/${id}`, {
                    method: 'PUT',
                    auth: true,
                    body: sharedFields,
                })
            ));

            // 2. Delete removed bookings
            if (removedIds.length > 0) {
                await Promise.all(removedIds.map(id =>
                    apiRequest(`/api/admin/bookings/${id}`, {
                        method: 'DELETE',
                        auth: true,
                    })
                ));
            }

            // 3. Add bookings for newly added venues
            if (addedVenueIds.length > 0) {
                const clubId = (booking as any).clubId;
                if (clubId) {
                    await apiRequest('/api/admin/bookings', {
                        method: 'POST',
                        auth: true,
                        body: {
                            club_id: clubId,
                            venue_ids: addedVenueIds,
                            event_name: eventName,
                            start_time: new Date(startTime).toISOString(),
                            end_time: new Date(endTime).toISOString(),
                            event_type: eventType || undefined,
                            expected_attendees: expectedAttendees ? parseInt(expectedAttendees) : undefined,
                            is_public: isPublic,
                        },
                    });
                }
            }

            onSaved();
            onOpenChange(false);
        } catch (err: any) {
            setError(err?.message || 'Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!booking) return;
        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }

        setDeleting(true);
        setError(null);

        try {
            // Delete ALL bookings in the group
            await Promise.all(booking.ids.map(id =>
                apiRequest(`/api/admin/bookings/${id}`, {
                    method: 'DELETE',
                    auth: true,
                })
            ));
            onDeleted();
            onOpenChange(false);
        } catch (err: any) {
            setError(err?.message || 'Failed to delete event');
        } finally {
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    const isMultiVenue = booking && booking.ids.length > 1;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Event</DialogTitle>
                    <DialogDescription>
                        Modify event details or delete this event entirely.
                        {isMultiVenue && (
                            <span className="block mt-1 text-brand font-medium">
                                This event spans multiple venues.
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}

                <div className="grid gap-4 py-2">
                    {/* Event Name */}
                    <div className="grid gap-2">
                        <Label htmlFor="edit-event-name">Event Name</Label>
                        <Input
                            id="edit-event-name"
                            value={eventName}
                            onChange={(e) => setEventName(e.target.value)}
                            placeholder="Event name"
                        />
                    </div>

                    {/* Venues — Multi-select checkboxes */}
                    <div className="grid gap-2">
                        <Label className="flex items-center gap-1.5">
                            <MapPin size={14} className="text-brand" />
                            Venues
                        </Label>
                        <div className="rounded-lg border border-borderSoft bg-background/50 p-3 grid gap-2 max-h-44 overflow-y-auto">
                            {venues.map(v => {
                                const checked = selectedVenueIds.includes(v.id);
                                return (
                                    <label
                                        key={v.id}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-brand/10 border border-brand/20' : 'hover:bg-hoverSoft'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleVenue(v.id)}
                                            className="accent-brand h-4 w-4"
                                        />
                                        <span className="text-sm text-textPrimary flex-1">{v.name}</span>
                                        {(v as any).category && (
                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                                {(v as any).category}
                                            </Badge>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                        <p className="text-xs text-textMuted">
                            {selectedVenueIds.length} venue{selectedVenueIds.length !== 1 ? 's' : ''} selected
                        </p>
                    </div>

                    {/* Start / End Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-start-time">Start Time</Label>
                            <Input
                                id="edit-start-time"
                                type="datetime-local"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-end-time">End Time</Label>
                            <Input
                                id="edit-end-time"
                                type="datetime-local"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Event Type & Status */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label>Event Type</Label>
                            <Select value={eventType} onValueChange={setEventType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {EVENT_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUSES.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Expected Attendees */}
                    <div className="grid gap-2">
                        <Label htmlFor="edit-attendees">Expected Attendees</Label>
                        <Input
                            id="edit-attendees"
                            type="number"
                            value={expectedAttendees}
                            onChange={(e) => setExpectedAttendees(e.target.value)}
                            placeholder="e.g. 100"
                        />
                    </div>

                    {/* Public Visibility toggle */}
                    <div className="flex items-center justify-between">
                        <Label htmlFor="edit-public">Publicly visible</Label>
                        <button
                            id="edit-public"
                            type="button"
                            role="switch"
                            aria-checked={isPublic}
                            onClick={() => setIsPublic(!isPublic)}
                            className={`
                                relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                                border-2 border-transparent transition-colors duration-200
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50
                                ${isPublic ? 'bg-brand' : 'bg-borderSoft'}
                            `}
                        >
                            <span
                                className={`
                                    pointer-events-none inline-block h-5 w-5 rounded-full
                                    bg-white shadow-lg transform transition-transform duration-200
                                    ${isPublic ? 'translate-x-5' : 'translate-x-0'}
                                `}
                            />
                        </button>
                    </div>
                </div>

                <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={saving || deleting}
                        className="gap-2"
                    >
                        {deleting ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Trash2 size={14} />
                        )}
                        {confirmDelete
                            ? `Confirm Delete${booking && booking.ids.length > 1 ? ` (all ${booking.ids.length} venues)` : ''}`
                            : 'Delete Event'}
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving || deleting || selectedVenueIds.length === 0}>
                            {saving && <Loader2 size={14} className="animate-spin mr-2" />}
                            Save Changes
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EditBookingDialog;
