import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { LoginPrompt } from '@/components/login-prompt';
import { TicketCard } from '@/components/ticket-card';
import { Banner, Button, ChipBar, OfflineBanner, StateView } from '@/components/ui';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useRefreshControl } from '@/hooks/use-refresh-control';
import { isActive, isFacilities, sortByUrgency } from '@/lib/tickets';
import { useAuthenticatedSession } from '@/state/session-context';
import { useTickets } from '@/state/tickets-context';
import type { Ticket } from '@/types/models';

type StudentFilter = 'all' | 'mine';
type StaffFilter = 'queue' | 'mine' | 'closed';

const STUDENT_FILTERS: { key: StudentFilter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'mine', label: 'เกี่ยวกับฉัน' },
];
const STAFF_FILTERS: { key: StaffFilter; label: string }[] = [
  { key: 'queue', label: 'รอรับเรื่อง' },
  { key: 'mine', label: 'งานของฉัน' },
  { key: 'closed', label: 'ปิดแล้ว' },
];

const openTicket = (id: string) => router.push({ pathname: '/tickets/[id]', params: { id } });

/**
 * นักศึกษา: เห็นทุกเรื่องในวิทยาเขต (ก่อนแจ้งเห็นว่ามีคนแจ้งแล้วหรือยัง)
 * เจ้าหน้าที่: คิวงานแจ้งซ่อมเรียงตามความเร่งด่วน (คนเจอเหมือนกันมาก/รอนาน/หมวดอันตราย ขึ้นก่อน)
 */
export default function TicketsScreen() {
  const session = useAuthenticatedSession();
  const { tickets, status, error, offlineSince, queued, refresh } = useTickets();
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');
  const [staffFilter, setStaffFilter] = useState<StaffFilter>('queue');
  // คิวงานเฉพาะเจ้าหน้าที่อาคาร · เจ้าหน้าที่กิจกรรมเห็นรายการแบบทั่วไปและแจ้งซ่อมได้
  const isStaff = isFacilities(session?.user);
  const userId = session?.user.id ?? '';

  const visible = useMemo((): Ticket[] => {
    if (isStaff) {
      const repairs = tickets.filter((t) => t.kind === 'repair');
      if (staffFilter === 'queue') return sortByUrgency(repairs.filter((t) => t.status === 'open'));
      if (staffFilter === 'mine') return repairs.filter((t) => t.assigneeId === userId && isActive(t));
      return repairs.filter((t) => !isActive(t));
    }
    const list =
      studentFilter === 'mine'
        ? tickets.filter((t) => t.reporterId === userId || t.assigneeId === userId || t.following)
        : tickets;
    // เรื่องที่ยังไม่จบขึ้นก่อน
    return [...list.filter(isActive), ...list.filter((t) => !isActive(t))];
  }, [isStaff, staffFilter, studentFilter, tickets, userId]);

  const refreshControl = useRefreshControl(refresh);

  const renderItem = useCallback(({ item }: { item: Ticket }) => <TicketCard ticket={item} onOpen={openTicket} />, []);

  if (!session) {
    return (
      <LoginPrompt
        icon="construct-outline"
        title="แจ้งซ่อม"
        message="เข้าสู่ระบบเพื่อแจ้งปัญหาในวิทยาเขต และติดตามว่าเจ้าหน้าที่ดำเนินการถึงไหนแล้ว"
        next="/tickets"
      />
    );
  }
  if (status === 'loading' && tickets.length === 0) return <StateView kind="loading" message="กำลังโหลดเรื่องแจ้ง…" />;
  if (status === 'error' && tickets.length === 0) {
    return <StateView kind="error" title="โหลดไม่สำเร็จ" message={error ?? undefined} actionLabel="ลองใหม่" onAction={refresh} />;
  }

  const header = (
    <View style={styles.header}>
      <OfflineBanner since={offlineSince} />
      {queued.length > 0 ? (
        <Banner tone="warning" icon="cloud-upload">
          มี {queued.length} เรื่องรอส่ง จะส่งให้อัตโนมัติเมื่อกลับมาออนไลน์
        </Banner>
      ) : null}
      {error && status === 'ready' ? <Banner tone="danger">{error}</Banner> : null}

      {isStaff ? (
        <ChipBar options={STAFF_FILTERS} value={staffFilter} onChange={setStaffFilter} />
      ) : (
        <>
          <Button title="แจ้งซ่อม" icon="construct" onPress={() => router.push('/tickets/new')} />
          <ChipBar options={STUDENT_FILTERS} value={studentFilter} onChange={setStudentFilter} />
        </>
      )}
      {isStaff && staffFilter === 'queue' && visible.length > 0 ? (
        <Text style={styles.hint}>เรียงตามความเร่งด่วน: คนเจอเหมือนกันมาก · รอนาน · ไฟฟ้า/ทางเดิน ขึ้นก่อน</Text>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={visible}
      keyExtractor={(t) => t.id}
      renderItem={renderItem}
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      refreshControl={refreshControl}
      ListEmptyComponent={
        <StateView
          kind="empty"
          icon="checkmark-done-circle-outline"
          title={isStaff ? (staffFilter === 'queue' ? 'ไม่มีเรื่องรอรับ' : 'ไม่มีรายการ') : 'ยังไม่มีเรื่องในหมวดนี้'}
          message={isStaff ? 'เมื่อมีคนแจ้งซ่อม จะมีแจ้งเตือนและเรื่องจะมาอยู่ที่นี่' : 'เจอปัญหาในวิทยาเขต แจ้งได้จากปุ่มด้านบน'}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg, gap: Spacing.md, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { gap: Spacing.md },
  hint: { fontSize: 13, color: Colors.textMuted },
});
