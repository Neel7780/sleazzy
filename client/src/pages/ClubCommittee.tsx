import React, { useState, useEffect } from 'react';
import { User, AppEvent } from '../types';
import { apiRequest } from '../lib/api';
import { toastError, toastSuccess } from '../lib/toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { type ApiVenue } from '../lib/api';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface ClubCommitteeProps {
  user: User;
}

const ClubCommittee: React.FC<ClubCommitteeProps> = ({ user }) => {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: '', date: '', venue: '' });
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [eventsData, venuesData] = await Promise.all([
        apiRequest<AppEvent[]>('/api/events', { auth: true }),
        apiRequest<ApiVenue[]>('/api/venues')
      ]);
      setEvents(eventsData);
      setVenues(venuesData);
    } catch (error) {
      toastError(error, 'Failed to fetch data');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateEvent = async () => {
    setIsSaving(true);
    try {
      await apiRequest('/api/events', {
        method: 'POST',
        auth: true,
        body: newEvent,
      });
      toastSuccess('Event created successfully');
      setIsAddEventOpen(false);
      setNewEvent({ name: '', date: '', venue: '' });
      fetchData();
    } catch (error) {
      toastError(error, 'Failed to create event');
    } finally {
      setIsSaving(false);
    }
  };

  const calendarEvents = events.map(e => ({
    title: `${e.name} (${e.venue})`,
    start: new Date(e.date),
    end: new Date(e.date),
    allDay: true,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-textPrimary tracking-tight flex items-center gap-2">
            <CalendarIcon className="text-brand" size={28} />
            Events & Calendar
          </h1>
          <p className="text-textMuted mt-1 text-sm sm:text-base">
            Register events and view your club's event calendar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate('/members')} variant="outline" className="rounded-xl">
            Edit Committee Members
          </Button>
          <Button onClick={() => setIsAddEventOpen(true)} className="rounded-xl bg-brand hover:bg-brand/90 text-white font-semibold">
            <Plus size={16} className="mr-1.5" />
            Register Event
          </Button>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border border-borderSoft shadow-sm h-[600px]">
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          views={['month', 'agenda']}
          style={{ height: '100%' }}
        />
      </div>

      <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Register a New Event</DialogTitle>
            <DialogDescription>
              Create an event to tie slot bookings to it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Event Name</Label>
              <Input
                value={newEvent.name}
                onChange={e => setNewEvent({ ...newEvent, name: e.target.value })}
                placeholder="e.g. Annual Tech Fest"
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={newEvent.date}
                onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label>Venue</Label>
              <Select value={newEvent.venue} onValueChange={(v) => setNewEvent({ ...newEvent, venue: v })}>
                <SelectTrigger className="rounded-xl h-10 border-borderSoft">
                  <SelectValue placeholder="Select Venue" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {venues.map(v => (
                    <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEventOpen(false)} className="rounded-xl">Cancel</Button>
            <Button 
              onClick={handleCreateEvent} 
              disabled={isSaving || !newEvent.name || !newEvent.date || !newEvent.venue}
              className="rounded-xl bg-brand hover:bg-brand/90 text-white font-semibold"
            >
              {isSaving ? 'Creating...' : 'Create Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClubCommittee;
